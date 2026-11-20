export interface Camera { x: number; y: number; scale: number; vx?: number; vy?: number; vScale?: number }
type Point = { x: number; y: number }

/** Default: frame every living unit, with room for labels and anticipated movement. */
export function targetCamera(points: Point[], width: number, height: number): Camera | null {
  if (!points.length) return null
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: Math.min(9, width / Math.max(70, maxX - minX + 36), height / Math.max(55, maxY - minY + 36)) }
}

/**
 * Focus: center on the selected unit and the unit it is engaging.
 * Zoom follows their separation, and still keeps both inside the frame.
 * With no engagement, follow the selected unit alone.
 */
export function focusCamera(subject: Point, engaged: Point | null, width: number, height: number): Camera {
  if (!engaged) return { x: subject.x, y: subject.y, scale: Math.min(8, width / 120, height / 96) }
  const dx = Math.abs(engaged.x - subject.x), dy = Math.abs(engaged.y - subject.y)
  const distance = Math.hypot(engaged.x - subject.x, engaged.y - subject.y)
  const byDistance = Math.min(width, height) * 0.62 / Math.max(28, distance)
  const byFrame = Math.min(width / Math.max(64, dx + 56), height / Math.max(52, dy + 48))
  return { x: (subject.x + engaged.x) / 2, y: (subject.y + engaged.y) / 2, scale: Math.min(12, byDistance, byFrame) }
}
/** Critically damped glide shared by the default and focus framings. About half a second to settle. */
function damp(current: number, target: number, velocity: number, dt: number): { value: number; velocity: number } {
  const omega = 2 / 0.22
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  const temp = (velocity + omega * change) * dt
  return { value: target + (change + temp) * exp, velocity: (velocity - omega * temp) * exp }
}
export function smoothCamera(camera: Camera, target: Camera, seconds: number): Camera {
  const dt = Math.max(0, Math.min(seconds, 0.05))
  const x = damp(camera.x, target.x, camera.vx ?? 0, dt)
  const y = damp(camera.y, target.y, camera.vy ?? 0, dt)
  const scale = damp(camera.scale, target.scale, camera.vScale ?? 0, dt)
  return { x: x.value, y: y.value, scale: scale.value, vx: x.velocity, vy: y.velocity, vScale: scale.velocity }
}
