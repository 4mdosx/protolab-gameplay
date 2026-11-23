import type { Body, Command, Motion, Recoil, Vec } from '../components'
import { HULL_RADIUS } from './hit'
import type { World } from '../engine/world'
import { terrainImpact, type TerrainBox } from '../../dogfight/terrain'

const COAST_LATERAL_SCALE = 0.2
const BD_LATERAL_SCALE = 0.05
const BD_MAX_THRUST_ANGLE = Math.PI / 3

function bdThrustAngle(desired: number, velocity: Vec, drag: number, force: number, avoiding: boolean) {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < 0.25 || force <= 0) return desired
  const course = Math.atan2(velocity.y, velocity.x)
  const error = Math.atan2(Math.sin(desired - course), Math.cos(desired - course))
  // Give the forward component enough force to offset drag where the thrust budget allows.
  const forwardShare = Math.min(0.95, drag * speed ** 2 / force)
  const turnLimit = avoiding ? Math.PI / 2 : Math.min(BD_MAX_THRUST_ANGLE, Math.acos(forwardShare))
  return course + clamp(error * 1.6, -turnLimit, turnLimit)
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function blocked(from: Vec, to: Vec, boxes: TerrainBox[]) {
  return terrainImpact(from, to, 'surface', boxes, HULL_RADIUS) !== null
}

/** Keep the open part of a step. A wall drops the blocked axis and the ship slides along the other. */
function slide(from: Vec, to: Vec, boxes: TerrainBox[]): Vec {
  if (!blocked(from, to, boxes)) return to
  const alongX = { x: to.x, y: from.y }
  const alongY = { x: from.x, y: to.y }
  if (!blocked(from, alongX, boxes)) return alongX
  if (!blocked(from, alongY, boxes)) return alongY
  return from
}

/** Velocity and hull facing are integrated separately. Position follows velocity. */
export function motionSystem(world: World, dt: number) {
  if (!(dt > 0)) return
  const boxes = world.city.buildings
  for (const id of world.ids) {
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    const command = world.command.get(id)
    if (!body || !motion || !command) continue
    const recoil = world.recoil.get(id) ?? []
    integrateMotion(body, motion, command, recoil, boxes, dt)
    world.recoil.set(
      id,
      recoil.filter((pulse) => pulse.remaining > 1e-8),
    )
  }
}

/** Advance one tick. Prediction calls this with copies of the mutable state. */
export function integrateMotion(
  body: Body,
  motion: Motion,
  command: Command,
  recoil: Recoil[],
  boxes: TerrainBox[],
  dt: number,
) {
  // Hull-relative quadratic drag: efficient forward travel, costly broadside slip.
  // Substeps keep drag and angular response stable at the fixed simulation tick.
  const velocity = { ...motion.velocity }
  const steps = Math.ceil(dt / 0.01)
  const h = dt / steps
  const stepDuration = (command.step?.fraction ?? 0) * dt
  for (let i = 0; i < steps; i++) {
    const desiredRate = command.turn * motion.maxTurnRate
    const turnAccel = motion.torque / motion.inertia
    const change = clamp(desiredRate - body.turnRate, -turnAccel * h, turnAccel * h)
    body.turnEffort = change / (turnAccel * h)
    body.turnRate += change
    body.heading += body.turnRate * h
    const step = i * h < stepDuration - 1e-8 ? command.step : undefined
    const braking = command.brakeFraction !== undefined
    const power = step?.power ?? command.power
    const lateralScale = command.bd ? BD_LATERAL_SCALE
      : power === 0 && !braking ? COAST_LATERAL_SCALE : 1
    const sideDrag = motion.drag + (motion.sideDrag - motion.drag) * lateralScale
    // Lateral stabilization removes sideways slip; it cannot add kinetic energy.
    // A force cap prevents high-speed turns from gaining unlimited grip.
    const nx = -Math.sin(body.heading),
      ny = Math.cos(body.heading)
    const slip = velocity.x * nx + velocity.y * ny
    const lateralAccel =
      clamp(-slip * motion.lateralGrip, -motion.maxLateralAccel, motion.maxLateralAccel) *
      lateralScale
    velocity.x += nx * lateralAccel * h
    velocity.y += ny * lateralAccel * h
    for (const pulse of recoil) {
      const active = Math.min(h, Math.max(0, pulse.remaining))
      velocity.x += (pulse.fx / motion.mass) * active
      velocity.y += (pulse.fy / motion.mass) * active
      pulse.remaining = Math.max(0, pulse.remaining - h)
    }
    if (command.brakeFraction !== undefined) {
      const speed = Math.hypot(velocity.x, velocity.y)
      const delta = (motion.thrust / motion.mass) * 1.5 * command.brakeFraction * h
      const scale = speed > 0 ? Math.max(0, 1 - delta / speed) : 0
      velocity.x *= scale
      velocity.y *= scale
    }
    const force = motion.thrust * power
    const angle = command.bd
      ? bdThrustAngle(command.thrustAngle, velocity, sideDrag, force, !!command.avoidingObstacle)
      : step?.angle ?? command.thrustAngle
    command.appliedThrustAngle = angle
    velocity.x += ((Math.cos(angle) * force) / motion.mass) * h
    velocity.y += ((Math.sin(angle) * force) / motion.mass) * h
    // Passive aerodynamic drag dissipates energy on both hull axes.
    // Use airspeed for both coefficients; orientation changes resistance.
    const speed = Math.hypot(velocity.x, velocity.y)
    const fx = Math.cos(body.heading),
      fy = Math.sin(body.heading)
    const forward =
      (velocity.x * fx + velocity.y * fy) / (1 + ((motion.drag * speed) / motion.mass) * h)
    const sideways =
      (velocity.x * nx + velocity.y * ny) / (1 + ((sideDrag * speed) / motion.mass) * h)
    velocity.x = fx * forward + nx * sideways
    velocity.y = fy * forward + ny * sideways
  }
  const from = { x: body.x, y: body.y }
  const intended = { x: from.x + velocity.x * dt, y: from.y + velocity.y * dt }
  const next = slide(from, intended, boxes)
  body.x = next.x
  body.y = next.y
  motion.velocity = { x: (next.x - from.x) / dt, y: (next.y - from.y) / dt }
  return next !== intended
}
