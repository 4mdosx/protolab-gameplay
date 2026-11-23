import type { Command, StepDirection, Vec } from '../components'
import type { Id, World } from '../engine/world'
import { terrainImpact } from '../../dogfight/terrain'
import { projectileHit } from './hit'
import { BD, HULL_RADIUS, STEP, STEP_ANGLE } from '../flight-config'
import { integrateMotion } from './motion'

/** Prefer a clear turn. Brake if turning alone cannot clear the predicted obstacle. */
export function avoidBDObstacle(world: World, id: Id, command: Command, dt: number, brakeFraction: number) {
  const body = world.body.get(id)!
  const motion = world.motion.get(id)!
  const ticks = Math.ceil(BD.lookahead / dt)
  const clearTicks = (candidate: Command) => {
    const pose = { ...body }
    const movement = { ...motion }
    const recoil = (world.recoil.get(id) ?? []).map(pulse => ({ ...pulse }))
    for (let tick = 0; tick < ticks; tick++) {
      if (integrateMotion(pose, movement, candidate, recoil, world.city.buildings, dt)) return tick
    }
    return ticks
  }

  let best = command
  let room = clearTicks(command)
  if (room === ticks) return

  const previous = world.command.get(id)
  const alternatives = BD.avoidanceOffsets.map(offset => command.thrustAngle + offset)
  if (previous?.avoidingObstacle && previous.brakeFraction === undefined) {
    alternatives.unshift(previous.thrustAngle)
  }

  for (const angle of alternatives) {
    const candidate = { ...command, thrustAngle: angle, avoidingObstacle: true }
    const clear = clearTicks(candidate)
    if (clear <= room) continue
    best = candidate
    room = clear
    if (room === ticks) break
  }

  if (room < ticks && brakeFraction > 0 && Math.hypot(motion.velocity.x, motion.velocity.y) > BD.minAvoidanceBrakeSpeed) {
    const braking = { ...command, power: 0, brakeFraction, avoidingObstacle: true }
    if (clearTicks(braking) >= room) best = braking
  }

  Object.assign(command, best)
}

interface PredictedRound {
  id: number
  from: Vec
  to: Vec
  fraction: number
  radius: number
}

function predictRounds(world: World, id: Id, dt: number): PredictedRound[][] {
  const ticks: PredictedRound[][] = Array.from({ length: STEP.predictionTicks }, () => [])
  for (const [index, shot] of world.projectiles.entries()) {
    if (shot.owner === id || shot.life <= 0) continue
    let from: Vec = shot
    for (let i = 0; i < ticks.length; i++) {
      const travel = Math.min(dt, shot.life - i * dt)
      if (travel <= 0) break
      const to = { x: from.x + shot.vx * travel, y: from.y + shot.vy * travel }
      const wall = terrainImpact(from, to, 'surface', world.city.buildings, shot.radius)
      const fraction = wall ?? 1
      ticks[i].push({
        id: index,
        from,
        radius: shot.radius,
        fraction: (fraction * travel) / dt,
        to: { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction },
      })
      if (wall !== null) break
      from = to
    }
  }
  return ticks
}

export function chooseStep(
  world: World,
  id: Id,
  current: Command,
  manual: Command,
  direction: StepDirection,
  dt: number,
): number | undefined {
  const body = world.body.get(id)!
  const motion = world.motion.get(id)!
  const rounds = predictRounds(world, id, dt)
  const burstEndTick = Math.ceil(STEP.duration / dt) - 1
  const estimate = (command: Command, angle?: number) => {
    const pose = { ...body }
    const movement = { ...motion }
    const recoil = (world.recoil.get(id) ?? []).map(pulse => ({ ...pulse }))
    const hits = new Set<number>()
    let clearance = Infinity
    let burstEnd = { x: pose.x, y: pose.y }

    for (let tick = 0; tick < Math.max(rounds.length, burstEndTick + 1); tick++) {
      const start = { x: pose.x, y: pose.y }
      const remaining = STEP.duration - tick * dt
      const action = angle !== undefined && remaining > 0 ? {
        ...command, step: { angle, fraction: Math.min(dt, remaining) / dt, power: STEP.power },
      } : command
      integrateMotion(pose, movement, action, recoil, world.city.buildings, dt)
      if (tick === burstEndTick) burstEnd = { x: pose.x, y: pose.y }
      for (const round of rounds[tick] ?? []) {
        const end = {
          x: start.x + (pose.x - start.x) * round.fraction,
          y: start.y + (pose.y - start.y) * round.fraction,
        }
        if (projectileHit(round.from, round.to, start, end, round.radius) !== null) hits.add(round.id)
        const x = round.from.x - start.x, y = round.from.y - start.y
        const dx = round.to.x - end.x - x, dy = round.to.y - end.y - y
        const length = dx * dx + dy * dy
        const closest = length > 0 ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0
        clearance = Math.min(clearance, Math.hypot(x + dx * closest, y + dy * closest) - HULL_RADIUS - round.radius)
      }
    }
    return { hits: hits.size, clearance, burstEnd }
  }

  const incoming = estimate(current).hits > 0
  const baseline = estimate(manual).burstEnd
  const preferredAngle = world.input.controlMode === 'tail'
    ? body.heading + ({ up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 })[direction]
    : STEP_ANGLE[direction]
  const directionX = Math.cos(preferredAngle)
  const directionY = Math.sin(preferredAngle)
  // Search the selected screen side only. Straight ahead wins equivalent routes.
  let best: { angle: number; hits: number; clearance: number } | undefined
  for (const offset of STEP.offsets) {
    const angle = preferredAngle + offset
    const candidate = estimate(manual, angle)
    const dx = candidate.burstEnd.x - baseline.x
    const dy = candidate.burstEnd.y - baseline.y
    if (dx * directionX + dy * directionY < STEP.minCourseChange) continue
    const saferTie = best && candidate.hits === best.hits && (incoming || candidate.hits > 0)
      && candidate.clearance > best.clearance + STEP.clearanceTieBreak
    if (!best || candidate.hits < best.hits || saferTie) {
      best = { angle, hits: candidate.hits, clearance: candidate.clearance }
    }
  }
  return best?.angle
}
