export interface Camera { x: number; y: number; scale: number }
export function targetCamera(points: { x: number; y: number }[], width: number, height: number): Camera | null {
  if (!points.length) return null
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  // Padding includes room for ship labels and anticipated movement.
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: Math.min(9, width / Math.max(70, maxX - minX + 36), height / Math.max(55, maxY - minY + 36)) }
}
export function smoothCamera(camera: Camera, target: Camera, seconds: number): Camera {
  const alpha = 1 - Math.exp(-Math.max(0, Math.min(seconds, 0.1)) * 3)
  return { x: camera.x + (target.x - camera.x) * alpha, y: camera.y + (target.y - camera.y) * alpha, scale: camera.scale + (target.scale - camera.scale) * alpha }
}
