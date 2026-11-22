import type { Vec } from '../components'
import type { World } from '../engine/world'
import { terrainImpact, type TerrainBox } from '../../dogfight/terrain'

const TURN_RATE = 0.8
const TURN_ACCEL = 1.2
const RADIUS = 2

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
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
    const errorX = command.velocity.x - motion.velocity.x
    const errorY = command.velocity.y - motion.velocity.y
    const error = Math.hypot(errorX, errorY) || 1
    const scale = Math.min(1, motion.thrust * dt / error)
    const velocity = { x: motion.velocity.x + errorX * scale, y: motion.velocity.y + errorY * scale }
    const delta = wrap(command.facing - body.heading)
    const desiredRate = clamp(delta * 2, -TURN_RATE, TURN_RATE)
    body.turnRate += clamp(desiredRate - body.turnRate, -TURN_ACCEL * dt, TURN_ACCEL * dt)
    body.heading += body.turnRate * dt
    const from = { x: body.x, y: body.y }
    const next = slide(from, { x: from.x + velocity.x * dt, y: from.y + velocity.y * dt }, boxes)
    body.x = next.x
    body.y = next.y
    motion.velocity = { x: (next.x - from.x) / dt, y: (next.y - from.y) / dt }
  }
}
