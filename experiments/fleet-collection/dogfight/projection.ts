/** Visual-only height in world units; collision always uses the unshifted XY. */
export const FLIGHT_HEIGHT = 5
export const HEIGHT_PROJECTION = 0.7
export function flightOffset(scale: number): number {
  return -FLIGHT_HEIGHT * HEIGHT_PROJECTION * scale
}
export function flightPoint(ground: { x: number; y: number }, scale: number) {
  return { x: ground.x, y: ground.y + flightOffset(scale) }
}
