import { smoothCamera, type Camera } from '../../dogfight/camera'
import type { Vec } from '../components'

export type { Camera }

const Y_SCALE = 0.78

export function followCamera(camera: Camera, target: Vec, seconds: number): Camera {
  return smoothCamera(camera, { x: target.x, y: target.y, scale: 5 }, seconds)
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
