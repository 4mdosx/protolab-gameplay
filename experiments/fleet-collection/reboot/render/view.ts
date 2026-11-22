import { smoothCamera, type Camera } from '../../dogfight/camera'
import type { Vec } from '../components'

export type { Camera }

const Y_SCALE = 0.78

/** Absolute speed mapping shared by all hulls; dash displacement itself does not trigger zoom. */
export function cameraScaleForSpeed(speed: number): number {
  const t = Math.max(0, Math.min(1, (speed - 8) / 52))
  const eased = t * t * (3 - 2 * t)
  // At 960px wide: 192m close view, expanding to 360m at 60m/s.
  return 960 / (192 + 168 * eased)
}

export function followCamera(camera: Camera, target: Vec, seconds: number, speed = 0): Camera {
  const next = smoothCamera(camera, { x: target.x, y: target.y, scale: camera.scale }, seconds)
  const desired = cameraScaleForSpeed(speed)
  const dt = Math.max(0, Math.min(seconds, 0.05))
  // Slower zoom than position tracking, monotonic and independent of frame rate.
  next.scale = camera.scale + (desired - camera.scale) * (1 - Math.exp(-1.8 * dt))
  next.vScale = 0
  return next
}

export function worldToScreen(camera: Camera, width: number, height: number, point: Vec) {
  return {
    x: width / 2 + (point.x - camera.x) * camera.scale,
    y: height / 2 + (point.y - camera.y) * camera.scale * Y_SCALE,
  }
}

export function screenToWorld(camera: Camera, width: number, height: number, sx: number, sy: number): Vec {
  return {
    x: camera.x + (sx - width / 2) / camera.scale,
    y: camera.y + (sy - height / 2) / (camera.scale * Y_SCALE),
  }
}

export function viewBounds(camera: Camera, width: number, height: number) {
  return {
    left: camera.x - width / (2 * camera.scale),
    right: camera.x + width / (2 * camera.scale),
    top: camera.y - height / (2 * camera.scale * Y_SCALE),
    bottom: camera.y + height / (2 * camera.scale * Y_SCALE),
  }
}
