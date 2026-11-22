import type { Command, Hull } from './types'
import { bearing } from './arc'
import { CRUISE } from './move'

const HOLD = 28

/** Face the other ship. Close when far, then slide sideways so the nose can stay on target. */
export function commandFor(self: Hull, other: Hull): Command {
  const dx = other.x - self.x
  const dy = other.y - self.y
  const distance = Math.hypot(dx, dy) || 1
  const ux = dx / distance
  const uy = dy / distance
  const facing = bearing(self, other)
  if (distance > HOLD) return { velocity: { x: ux * CRUISE, y: uy * CRUISE }, facing }
  const side = self.team === 'blue' ? 1 : -1
  return { velocity: { x: -uy * side * CRUISE * 0.8, y: ux * side * CRUISE * 0.8 }, facing }
}
