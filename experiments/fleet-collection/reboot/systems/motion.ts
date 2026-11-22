import { damageShip, segmentCircle } from './hit'
import { ENERGY } from './energy'
import type { Vec } from '../components'
import type { World } from '../engine/world'
import { terrainImpact, type TerrainBox } from '../../dogfight/terrain'

const RADIUS = 2

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
    const visual = world.dashVisual.get(id)
    if (visual) {
      visual.life = Math.max(0, visual.life - dt)
      visual.evade = Math.max(0, visual.evade - dt)
      if (visual.life === 0) world.dashVisual.delete(id)
    }
    // Hull-relative quadratic drag: efficient forward travel, costly broadside slip.
    // Substeps keep drag and angular response stable at the fixed simulation tick.
    const velocity = { ...motion.velocity }
    const recoil = world.recoil.get(id) ?? []
    const steps = Math.ceil(dt / 0.01)
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const desiredRate = command.turn * motion.maxTurnRate
      const turnAccel = motion.torque / motion.inertia
      const change = clamp(desiredRate - body.turnRate, -turnAccel * h, turnAccel * h)
      body.turnEffort = change / (turnAccel * h)
      body.turnRate += change
      body.heading += body.turnRate * h
      // Lateral stabilization removes sideways slip; it cannot add kinetic energy.
      // A force cap prevents high-speed turns from gaining unlimited grip.
      const nx = -Math.sin(body.heading), ny = Math.cos(body.heading)
      const slip = velocity.x * nx + velocity.y * ny
      const lateralAccel = clamp(-slip * motion.lateralGrip, -motion.maxLateralAccel, motion.maxLateralAccel)
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
      const dash = (command.dashFraction ?? 0) * dt
      const boosting = i * h < dash - 1e-8
      const power = command.braking ? 0 : boosting ? ENERGY.dashPower : command.power
      const force = motion.thrust * power
      velocity.x += Math.cos(command.thrustAngle) * force / motion.mass * h
      velocity.y += Math.sin(command.thrustAngle) * force / motion.mass * h
      // Passive aerodynamic drag dissipates energy on both hull axes.
      // Use airspeed for both coefficients; orientation changes resistance.
      const speed = Math.hypot(velocity.x, velocity.y)
      const fx = Math.cos(body.heading), fy = Math.sin(body.heading)
      const forward = (velocity.x * fx + velocity.y * fy) / (1 + motion.drag * speed / motion.mass * h)
      const sideways = (velocity.x * nx + velocity.y * ny) / (1 + motion.sideDrag * speed / motion.mass * h)
      velocity.x = fx * forward + nx * sideways
      velocity.y = fy * forward + ny * sideways
    }
    world.recoil.set(id, recoil.filter(pulse => pulse.remaining > 1e-8))
    const from = { x: body.x, y: body.y }
    const next = slide(from, { x: from.x + velocity.x * dt, y: from.y + velocity.y * dt }, boxes)
    body.x = next.x
    body.y = next.y
    motion.velocity = { x: (next.x - from.x) / dt, y: (next.y - from.y) / dt }
    // Destroyer-only displacement does not become persistent velocity.
    const distance = command.dashStep ?? 0
    command.dashStep = 0
    if (distance > 0) {
      const start = { x: body.x, y: body.y }
      const end = { x: start.x + Math.cos(command.thrustAngle) * distance, y: start.y + Math.sin(command.thrustAngle) * distance }
      const hit = terrainImpact(start, end, 'surface', boxes, RADIUS)
      const fraction = hit === null ? 1 : Math.max(0, hit - 0.01 / distance)
      body.x += (end.x - start.x) * fraction
      body.y += (end.y - start.y) * fraction
      const landing = { x: body.x, y: body.y }
      // The transit remains vulnerable; only the destination gets a grace window.
      for (const shot of world.projectiles) {
        if (shot.life <= 0 || shot.owner === id) continue
        const crossing = segmentCircle(start, landing, shot, RADIUS + shot.radius)
        const atLanding = Math.hypot(landing.x - shot.x, landing.y - shot.y) <= RADIUS + shot.radius
        if (crossing !== null && !atLanding) damageShip(world, id, shot)
      }
      world.dashVisual.set(id, { from: start, to: landing, heading: body.heading, life: 0.35, evade: 0.12 })
    }
  }
}
