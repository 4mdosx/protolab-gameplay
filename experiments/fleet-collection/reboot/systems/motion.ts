import { ENERGY } from './energy'
import type { Vec } from '../components'
import type { World } from '../engine/world'
import { terrainImpact, type TerrainBox } from '../../dogfight/terrain'

const RADIUS = 2
const COAST_LATERAL_SCALE = 0.2

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function blocked(from: Vec, to: Vec, boxes: TerrainBox[]) {
  return terrainImpact(from, to, 'surface', boxes, RADIUS) !== null
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
    // Hull-relative quadratic drag: efficient forward travel, costly broadside slip.
    // Substeps keep drag and angular response stable at the fixed simulation tick.
    const velocity = { ...motion.velocity }
    const recoil = world.recoil.get(id) ?? []
    const steps = Math.ceil(dt / 0.01)
    const h = dt / steps
    const dashDuration = (command.dashFraction ?? 0) * dt
    for (let i = 0; i < steps; i++) {
      const desiredRate = command.turn * motion.maxTurnRate
      const turnAccel = motion.torque / motion.inertia
      const change = clamp(desiredRate - body.turnRate, -turnAccel * h, turnAccel * h)
      body.turnEffort = change / (turnAccel * h)
      body.turnRate += change
      body.heading += body.turnRate * h
      const boosting = i * h < dashDuration - 1e-8
      const power = command.braking ? 0 : boosting ? ENERGY.dashPower : command.power
      const lateralScale = power === 0 && !command.braking ? COAST_LATERAL_SCALE : 1
      const sideDrag = motion.drag + (motion.sideDrag - motion.drag) * lateralScale
      // Lateral stabilization removes sideways slip; it cannot add kinetic energy.
      // A force cap prevents high-speed turns from gaining unlimited grip.
      const nx = -Math.sin(body.heading), ny = Math.cos(body.heading)
      const slip = velocity.x * nx + velocity.y * ny
      const lateralAccel = clamp(-slip * motion.lateralGrip, -motion.maxLateralAccel, motion.maxLateralAccel) * lateralScale
      velocity.x += nx * lateralAccel * h
      velocity.y += ny * lateralAccel * h
      for (const pulse of recoil) {
        const active = Math.min(h, Math.max(0, pulse.remaining))
        velocity.x += pulse.fx / motion.mass * active
        velocity.y += pulse.fy / motion.mass * active
        pulse.remaining = Math.max(0, pulse.remaining - h)
      }
      if (command.braking) {
        const speed = Math.hypot(velocity.x, velocity.y)
        const delta = motion.thrust / motion.mass * 1.5 * (command.brakeFraction ?? 1) * h
        const scale = speed > 0 ? Math.max(0, 1 - delta / speed) : 0
        velocity.x *= scale; velocity.y *= scale
      }
      const force = motion.thrust * power
      velocity.x += Math.cos(command.thrustAngle) * force / motion.mass * h
      velocity.y += Math.sin(command.thrustAngle) * force / motion.mass * h
      // Passive aerodynamic drag dissipates energy on both hull axes.
      // Use airspeed for both coefficients; orientation changes resistance.
      const speed = Math.hypot(velocity.x, velocity.y)
      const fx = Math.cos(body.heading), fy = Math.sin(body.heading)
      const forward = (velocity.x * fx + velocity.y * fy) / (1 + motion.drag * speed / motion.mass * h)
      const sideways = (velocity.x * nx + velocity.y * ny) / (1 + sideDrag * speed / motion.mass * h)
      velocity.x = fx * forward + nx * sideways
      velocity.y = fy * forward + ny * sideways
    }
    world.recoil.set(id, recoil.filter(pulse => pulse.remaining > 1e-8))
    const from = { x: body.x, y: body.y }
    const next = slide(from, { x: from.x + velocity.x * dt, y: from.y + velocity.y * dt }, boxes)
    body.x = next.x
    body.y = next.y
    motion.velocity = { x: (next.x - from.x) / dt, y: (next.y - from.y) / dt }
  }
}
