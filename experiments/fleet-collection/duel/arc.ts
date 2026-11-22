import type { Vec } from './types'

/** Half-angle of the forward gun cone. Fire and the drawn wedge both use this. */
export const ARC_HALF = 60 * Math.PI / 180
/** World units. The wedge is drawn out to this distance, and shots stop being allowed past it. */
export const GUN_RANGE = 38

export function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function bearing(from: Vec, to: Vec) {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/** True when the target lies inside the nose cone and inside gun range. */
export function inArc(from: Vec & { heading: number }, to: Vec, range = GUN_RANGE, half = ARC_HALF) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance > range) return false
  return Math.abs(wrap(bearing(from, to) - from.heading)) <= half
}

/** Boundary of the cone in world space, from one edge through the nose to the other edge. */
export function arcRim(from: Vec & { heading: number }, range = GUN_RANGE, half = ARC_HALF, steps = 16): Vec[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from.heading - half + (2 * half * i) / steps
    return { x: from.x + Math.cos(angle) * range, y: from.y + Math.sin(angle) * range }
  })
}
