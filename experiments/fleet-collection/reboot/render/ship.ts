import type { Camera } from '../../dogfight/camera'
import type { Pose } from '../components'
import { flightPoint } from '../../dogfight/projection'
import { worldToScreen } from './view'

const DEAD_RADIUS = 18

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export interface ShipDraw { pose: Pose; arc: number; name: string }

/** Hull, gun, speed line and the mount's blind sector. All of them share one world projection. */
export function drawShip(ctx: CanvasRenderingContext2D, camera: Camera, ship: ShipDraw) {
  const { width, height } = ctx.canvas
  const { pose, arc } = ship
  const at = (x: number, y: number) => flightPoint(worldToScreen(camera, width, height, { x, y }), camera.scale)
  const origin = at(pose.x, pose.y)
  const ground = worldToScreen(camera, width, height, pose)
  ctx.fillStyle = '#69d5d455'
  ctx.beginPath()
  ctx.ellipse(ground.x, ground.y, 5, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#69d5d4'
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(ground.x, ground.y)
  ctx.lineTo(origin.x, origin.y)
  ctx.stroke()
  ctx.setLineDash([])
  const rim = (angle: number, radius: number) => at(pose.x + Math.cos(angle) * radius, pose.y + Math.sin(angle) * radius)
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  const steps = 28
  const sweep = Math.PI * 2 - arc * 2
  for (let i = 0; i <= steps; i++) ctx.lineTo(rim(pose.heading + arc + sweep * i / steps, DEAD_RADIUS).x, rim(pose.heading + arc + sweep * i / steps, DEAD_RADIUS).y)
  ctx.closePath()
  ctx.fillStyle = '#f08b8328'
  ctx.fill()
  ctx.strokeStyle = '#f4fff8aa'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const left = rim(pose.heading - arc, DEAD_RADIUS)
  const right = rim(pose.heading + arc, DEAD_RADIUS)
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(left.x, left.y)
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(right.x, right.y)
  ctx.stroke()
  const barrel = rim(pose.heading + pose.gun, 8)
  ctx.strokeStyle = '#e6bd69'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(barrel.x, barrel.y)
  ctx.stroke()
  if (pose.dead && pose.aim !== null) {
    const blocked = rim(pose.aim, DEAD_RADIUS)
    ctx.strokeStyle = '#ff8d7a'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.lineTo(blocked.x, blocked.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  const speed = Math.hypot(pose.vx, pose.vy)
  if (speed > 0.4) {
    const tip = at(pose.x + pose.vx * 0.6, pose.y + pose.vy * 0.6)
    ctx.strokeStyle = '#f4fff8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.stroke()
  }
  const nose = at(pose.x + Math.cos(pose.heading) * 3.2, pose.y + Math.sin(pose.heading) * 3.2)
  const port = at(pose.x + Math.cos(pose.heading + 2.5) * 2.1, pose.y + Math.sin(pose.heading + 2.5) * 2.1)
  const starboard = at(pose.x + Math.cos(pose.heading - 2.5) * 2.1, pose.y + Math.sin(pose.heading - 2.5) * 2.1)
  ctx.beginPath()
  ctx.moveTo(nose.x, nose.y)
  ctx.lineTo(port.x, port.y)
  ctx.lineTo(starboard.x, starboard.y)
  ctx.closePath()
  ctx.fillStyle = '#69d5d4'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '12px sans-serif'
  ctx.fillText(ship.name, origin.x + 12, origin.y - 6)
  return { x: origin.x, y: origin.y, depth: pose.y }
}

export function lerpPose(from: Pose, to: Pose, alpha: number): Pose {
  const turn = wrap(to.heading - from.heading)
  const gun = wrap(to.gun - from.gun)
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    heading: from.heading + turn * alpha,
    vx: from.vx + (to.vx - from.vx) * alpha,
    vy: from.vy + (to.vy - from.vy) * alpha,
    gun: from.gun + gun * alpha,
    dead: to.dead,
    aim: to.aim,
  }
}
