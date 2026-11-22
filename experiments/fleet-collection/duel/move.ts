import type { Command, Hull } from './types'

export const CRUISE = 15
export const THRUST = 18
const TURN_RATE = 0.8
const TURN_ACCEL = 1.2

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Chase the commanded velocity and facing. Position follows velocity, not the nose. */
export function moveHull(hull: Hull, command: Command, dt: number): Hull {
  const errorX = command.velocity.x - hull.velocity.x
  const errorY = command.velocity.y - hull.velocity.y
  const error = Math.hypot(errorX, errorY) || 1
  const scale = Math.min(1, THRUST * dt / error)
  const velocity = { x: hull.velocity.x + errorX * scale, y: hull.velocity.y + errorY * scale }
  const delta = Math.atan2(Math.sin(command.facing - hull.heading), Math.cos(command.facing - hull.heading))
  const desiredRate = clamp(delta * 2, -TURN_RATE, TURN_RATE)
  const turnRate = hull.turnRate + clamp(desiredRate - hull.turnRate, -TURN_ACCEL * dt, TURN_ACCEL * dt)
  const heading = hull.heading + turnRate * dt
  return { ...hull, velocity, turnRate, heading, x: hull.x + velocity.x * dt, y: hull.y + velocity.y * dt }
}
