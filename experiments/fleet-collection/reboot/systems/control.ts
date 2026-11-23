import type { Command, Vec } from '../components'
import { lockedTarget, type World } from '../engine/world'
import { ENERGY, recoverEnergy, spendEnergy } from './energy'
import { avoidBDObstacle, chooseStep, STEP } from './maneuver'

export const THROTTLE_POWER = { 1: 0.1, 2: 0.35 } as const
const HEADING_GAIN = 2
const HEADING_TOLERANCE = 0.025

function headingError(target: number, current: number) {
  const error = target - current
  return Math.atan2(Math.sin(error), Math.cos(error))
}

export function pointerThrustAngle(origin: Vec, aim: Vec | null, towardPointer: boolean) {
  if (!aim || Math.hypot(aim.x - origin.x, aim.y - origin.y) <= 1) return
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

    const pointerAngle = pointerThrustAngle(body, input.aim, input.reverseControl)
    const target = lockedTarget(world, id)
    const weaponMode = !!input.selectedGun
    if (!input.boostHeld || input.boostPressed) pilot.boostInterrupted = false
    if (input.boostPressed) pilot.bdCourse = undefined
    const wantsFullThrust = input.boostHeld && !pilot.boostInterrupted
    const canUseFullThrust = wantsFullThrust && !energy.locked && energy.value > 0
    const wantsBD = canUseFullThrust && !!target
    const manualAngle = weaponMode ? pilot.thrustAngle : pointerAngle ?? pilot.thrustAngle
    const route = wantsBD && !input.brake && !energy.step
    if (route && input.recenterHeading !== undefined) pilot.bdCourse = input.recenterHeading
    const thrustIntent = wantsBD ? pilot.bdCourse ?? pointerAngle ?? pilot.thrustAngle : manualAngle

    if (!route && input.recenterHeading !== undefined) {
      pilot.recenterAngle = input.recenterHeading
    } else if (input.boostPressed && target) {
      pilot.recenterAngle = undefined
    }
    let recenterError = pilot.recenterAngle === undefined
      ? undefined : headingError(pilot.recenterAngle, body.heading)
    if (recenterError !== undefined && Math.abs(recenterError) < HEADING_TOLERANCE &&
        Math.abs(body.turnRate) < HEADING_TOLERANCE) {
      pilot.recenterAngle = undefined
      recenterError = undefined
    }
    const manual: Command = {
      power: weaponMode || pointerAngle !== undefined ? THROTTLE_POWER[input.throttle] : 0,
      thrustAngle: manualAngle,
      recentering: recenterError !== undefined,
      turn: recenterError === undefined ? input.turn
        : Math.max(-1, Math.min(1, HEADING_GAIN * recenterError / motion.maxTurnRate)),
    }
    const full = { ...manual, thrustAngle: thrustIntent, power: 1, fullThrust: true }
    if (wantsBD && target) {
      full.turn = Math.max(-1, Math.min(1, HEADING_GAIN * headingError(
        Math.atan2(target.y - body.y, target.x - body.x), body.heading,
      ) / motion.maxTurnRate))
    }
    const thrustAvailable = !!target || weaponMode || pointerAngle !== undefined
    const fullCommand = canUseFullThrust && thrustAvailable ? { ...full, bd: wantsBD } : undefined
    const speed = Math.hypot(motion.velocity.x, motion.velocity.y)
    const brakeTime = Math.min(dt, speed / (motion.thrust / motion.mass * 1.5))
    const brakeCost = ENERGY.brakeDrain * brakeTime
    const brakeFraction = brakeCost > 0 ? Math.min(1, energy.value / brakeCost) : 0
    if (route && fullCommand && pilot.bdCourse === undefined) {
      avoidBDObstacle(world, id, fullCommand, dt, brakeFraction)
    }
    let command = manual

    if (input.brake) {
      if (input.boostHeld) pilot.boostInterrupted = true
      energy.step = undefined
      energy.feedback = undefined
      command = { ...manual, power: 0 }
      if (!energy.locked && speed > 0.05) {
        // Charge only for the portion of the tick in which braking can act.
        command.brakeFraction = brakeFraction
        spendEnergy(energy, brakeCost * brakeFraction)
      } else recoverEnergy(energy, dt)
    } else {
      if (input.stepDirection && !energy.step) {
        if (energy.locked || energy.value < STEP.cost) energy.feedback = 'Step 能量不足'
        else {
          const angle = chooseStep(world, id, fullCommand ?? manual, manual, input.stepDirection, dt)
          if (angle === undefined) energy.feedback = 'Step 无变轨空间'
          else {
            spendEnergy(energy, STEP.cost)
            energy.step = { angle, remaining: STEP.duration }
            if (input.boostHeld) pilot.boostInterrupted = true
            energy.feedback = 'Step 已接管推进'
          }
        }
      }
      if (energy.step) {
        if (input.boostHeld) pilot.boostInterrupted = true
        command = { ...manual, step: {
          angle: energy.step.angle, fraction: Math.min(dt, energy.step.remaining) / dt, power: STEP.power,
        } }
        energy.step.remaining -= dt
        if (energy.step.remaining <= 1e-8) energy.step = undefined
      } else if (fullCommand) {
        if (fullCommand.brakeFraction !== undefined) {
          command = fullCommand
          spendEnergy(energy, brakeCost * fullCommand.brakeFraction)
        } else {
          const fraction = Math.min(1, energy.value / (ENERGY.fullDrain * dt))
          command = { ...fullCommand, power: manual.power + (1 - manual.power) * fraction }
          spendEnergy(energy, ENERGY.fullDrain * dt * fraction)
        }
        if (energy.locked) pilot.boostInterrupted = true
      } else {
        if (wantsFullThrust && energy.locked) pilot.boostInterrupted = true
        recoverEnergy(energy, dt)
      }
    }

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
