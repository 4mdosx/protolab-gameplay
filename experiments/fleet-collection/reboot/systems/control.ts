import type { Command, Energy, Pilot, Vec } from '../components'
import { lockedTarget, type Id, type World } from '../engine/world'
import { recoverEnergy, spendEnergy } from './energy'
import { avoidBDObstacle, chooseStep } from './maneuver'
import { BRAKE, ENERGY, HEADING, STEP, THROTTLE_POWER } from '../flight-config'

function headingError(target: number, current: number) {
  const error = target - current
  return Math.atan2(Math.sin(error), Math.cos(error))
}

export function pointerThrustAngle(origin: Vec, aim: Vec | null, towardPointer: boolean) {
  if (!aim || Math.hypot(aim.x - origin.x, aim.y - origin.y) <= HEADING.pointerDeadZone) return
  return Math.atan2(aim.y - origin.y, aim.x - origin.x) + (towardPointer ? 0 : Math.PI)
}

export function controlSystem(world: World, dt: number) {
  const input = world.input
  for (const id of world.ids) {
    const pilot = world.pilot.get(id)
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    const energy = world.energy.get(id)
    if (!pilot || !body || !motion || !energy) continue

    const tailMode = input.controlMode === 'tail'
    if (!input.boostHeld || input.brake || !tailMode) pilot.boostCourse = undefined
    if (pilot.stepLink) {
      pilot.stepLink.remaining -= dt
      if (pilot.stepLink.remaining < -1e-8) pilot.stepLink = undefined
    }
    if (tailMode && input.boostPressed && pilot.stepLink && !input.brake) {
      pilot.boostCourse = pilot.stepLink.angle
    }
    const holdHeading = tailMode && (input.headingHold || !!input.selectedGun)
    if (holdHeading && pilot.heldHeading === undefined) pilot.heldHeading = body.heading
    if (!holdHeading) pilot.heldHeading = undefined
    const pointerAngle = pointerThrustAngle(body, input.aim, input.reverseControl)
    const target = lockedTarget(world, id)
    const weaponMode = !!input.selectedGun
    if (!input.boostHeld || input.boostPressed) pilot.boostInterrupted = false
    if (input.boostPressed) pilot.bdCourse = undefined
    const wantsFullThrust = !!input.boostHeld && !pilot.boostInterrupted
    const canUseFullThrust = wantsFullThrust && !energy.locked && energy.value > 0
    const wantsBD = canUseFullThrust && !!target
    const manualAngle = weaponMode ? pilot.thrustAngle : pointerAngle ?? pilot.thrustAngle
    const canCaptureBDCourse = wantsBD && !input.brake && !energy.step
    if (canCaptureBDCourse && input.recenterHeading !== undefined) pilot.bdCourse = input.recenterHeading
    const thrustIntent = wantsBD ? pilot.bdCourse ?? pointerAngle ?? pilot.thrustAngle : manualAngle

    if (!canCaptureBDCourse && input.recenterHeading !== undefined) {
      pilot.recenterAngle = input.recenterHeading
    } else if (input.boostPressed && target) {
      pilot.recenterAngle = undefined
    }
    let recenterError = pilot.recenterAngle === undefined
      ? undefined : headingError(pilot.recenterAngle, body.heading)
    if (recenterError !== undefined && Math.abs(recenterError) < HEADING.angleTolerance &&
        Math.abs(body.turnRate) < HEADING.rateTolerance) {
      pilot.recenterAngle = undefined
      recenterError = undefined
    }
    const mouseHeading = pointerThrustAngle(body, input.aim, true)
    const manual: Command = {
      power: weaponMode || pointerAngle !== undefined ? THROTTLE_POWER[input.throttle] : 0,
      thrustAngle: manualAngle,
      recentering: recenterError !== undefined,
      turn: recenterError === undefined ? input.turn
        : Math.max(-1, Math.min(1, HEADING.gain * recenterError / motion.maxTurnRate)),
    }
    if (tailMode) {
      manual.hullThrust = true
      manual.thrustAngle = body.heading
      manual.power = THROTTLE_POWER[input.throttle]
      manual.recentering = false
      const desiredHeading = pilot.heldHeading ?? mouseHeading
      manual.turn = desiredHeading === undefined ? 0 : Math.max(-1, Math.min(1, HEADING.gain * headingError(desiredHeading, body.heading) / motion.maxTurnRate))
      pilot.recenterAngle = undefined
      pilot.bdCourse = undefined
    }
    const full = { ...manual, thrustAngle: thrustIntent, power: 1, fullThrust: true }
    if (tailMode) {
      full.hullThrust = !wantsBD
      full.thrustAngle = wantsBD && target ? Math.atan2(target.y - body.y, target.x - body.x) : body.heading
    }
    if (!tailMode && wantsBD && target) {
      full.turn = Math.max(-1, Math.min(1, HEADING.gain * headingError(
        Math.atan2(target.y - body.y, target.x - body.x), body.heading,
      ) / motion.maxTurnRate))
    }
    const thrustAvailable = tailMode || !!target || weaponMode || pointerAngle !== undefined
    if (tailMode && pilot.boostCourse !== undefined) {
      full.hullThrust = false
      full.thrustAngle = pilot.boostCourse
    }
    const fullCommand = canUseFullThrust && thrustAvailable ? { ...full, bd: wantsBD && pilot.boostCourse === undefined } : undefined
    const speed = Math.hypot(motion.velocity.x, motion.velocity.y)
    const brakeTime = Math.min(dt, speed / (motion.thrust / motion.mass * BRAKE.thrustMultiplier))
    const brakeCost = ENERGY.brakeDrain * brakeTime
    const brakeFraction = brakeCost > 0 ? Math.min(1, energy.value / brakeCost) : 0
    if (!tailMode && canCaptureBDCourse && fullCommand && pilot.bdCourse === undefined) {
      avoidBDObstacle(world, id, fullCommand, dt, brakeFraction)
    }
    const command = selectPropulsion(world, id, dt, pilot, energy, {
      manual, boost: fullCommand, wantsFullThrust, speed, brakeCost, brakeFraction,
    })

    if (!weaponMode && pointerAngle !== undefined) pilot.thrustAngle = pointerAngle
    if (command.bd) {
      pilot.recenterAngle = undefined
      command.recentering = false
    } else pilot.bdCourse = undefined
    world.command.set(id, command)
  }
  input.boostPressed = false
  input.recenterHeading = undefined
  input.stepDirection = undefined
}

interface PropulsionOptions {
  manual: Command
  boost?: Command
  wantsFullThrust: boolean
  speed: number
  brakeCost: number
  brakeFraction: number
}

/** Resolve the highest-priority action and make exactly one energy decision for this tick. */
function selectPropulsion(
  world: World,
  id: Id,
  dt: number,
  pilot: Pilot,
  energy: Energy,
  options: PropulsionOptions,
): Command {
  const input = world.input
  const { manual, boost, wantsFullThrust, speed, brakeCost, brakeFraction } = options

  // 1. Manual brake takes over immediately.
  if (input.brake) {
    if (input.boostHeld) pilot.boostInterrupted = true
    energy.step = undefined
    pilot.stepLink = undefined
    pilot.boostCourse = undefined
    energy.feedback = undefined
    if (!energy.locked && speed > BRAKE.minSpeed) {
      spendEnergy(energy, brakeCost * brakeFraction)
      return { ...manual, power: 0, brakeFraction }
    }
    recoverEnergy(energy, dt)
    return { ...manual, power: 0 }
  }

  // 2. A paid Step takes over. A rejected request falls through to the current action.
  if (input.stepDirection && !energy.step) {
    if (energy.locked || energy.value < STEP.cost) {
      energy.feedback = 'Step 能量不足'
    } else {
      const angle = chooseStep(world, id, boost ?? manual, manual, input.stepDirection, dt)
      if (angle === undefined) {
        energy.feedback = 'Step 无变轨空间'
      } else {
        spendEnergy(energy, STEP.cost)
        energy.step = { angle, remaining: STEP.duration }
        if (input.controlMode === 'tail') {
          pilot.stepLink = { angle, remaining: STEP.boostLinkWindow }
          if (input.boostPressed && input.boostHeld) pilot.boostCourse = angle
        }
        energy.feedback = 'Step 已接管推进'
      }
    }
  }
  if (energy.step) {
    if (input.boostHeld && pilot.boostCourse === undefined) pilot.boostInterrupted = true
    const { angle, remaining } = energy.step
    energy.step.remaining -= dt
    if (energy.step.remaining <= 1e-8) energy.step = undefined
    return { ...manual, step: { angle, fraction: Math.min(dt, remaining) / dt, power: STEP.power } }
  }

  // 3. Held boost, including locked BD and its own automatic braking.
  if (boost) {
    if (boost.brakeFraction !== undefined) {
      spendEnergy(energy, brakeCost * boost.brakeFraction)
    } else {
      const fraction = Math.min(1, energy.value / (ENERGY.fullDrain * dt))
      boost.power = manual.power + (1 - manual.power) * fraction
      spendEnergy(energy, ENERGY.fullDrain * dt * fraction)
    }
    if (energy.locked) pilot.boostInterrupted = true
    return boost
  }

  // 4. The selected gear or zero-thrust coasting.
  if (wantsFullThrust && energy.locked) pilot.boostInterrupted = true
  recoverEnergy(energy, dt)
  return manual
}
