import type { Camera } from '../../dogfight/camera'
import { drawHumanoid } from './humanoid'
import type { Pose, Vec } from '../components'
import { flightPoint } from '../../dogfight/projection'
import { worldToScreen } from './view'

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export interface ShipDraw {
  tailMode?: boolean
  acceleration: Vec
  pose: Pose
  thrustAngle: number
  power: number
  exhaustAngle: number
  turnEffort: number
  name: string
}

/** Flight platform HUD, attitude jets and articulated geometric pilot. */
export function drawShip(ctx: CanvasRenderingContext2D, camera: Camera, ship: ShipDraw) {
  const { width, height } = ctx.canvas
  const { pose } = ship
  const at = (x: number, y: number) =>
    flightPoint(worldToScreen(camera, width, height, { x, y }), camera.scale)
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
  const rim = (angle: number, radius: number) =>
    at(pose.x + Math.cos(angle) * radius, pose.y + Math.sin(angle) * radius)
  // Rear armor vulnerability HUD, ±45 degrees around the stern.
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  for (let i = 0; i <= 20; i++) {
    const edge = rim(pose.heading + Math.PI - Math.PI / 4 + (i * Math.PI) / 40, 5)
    ctx.lineTo(edge.x, edge.y)
  }
  ctx.closePath()
  ctx.fillStyle = '#ff707030'
  ctx.fill()
  ctx.strokeStyle = '#ff707088'
  ctx.lineWidth = 1
  ctx.stroke()
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
  // Opposed attitude jets produce torque; reverse firing brakes angular motion.
  if (Math.abs(ship.turnEffort) > 0.01) {
    ctx.save()
    ctx.strokeStyle = '#a5e9ff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (const end of [-1, 1]) {
      const x = pose.x + Math.cos(pose.heading) * end * 2.4
      const y = pose.y + Math.sin(pose.heading) * end * 2.4
      const angle = pose.heading - (Math.sign(ship.turnEffort) * end * Math.PI) / 2
      const start = at(x, y)
      const tip = at(
        x + Math.cos(angle) * (0.8 + Math.abs(ship.turnEffort) * 2.5),
        y + Math.sin(angle) * (0.8 + Math.abs(ship.turnEffort) * 2.5),
      )
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(tip.x, tip.y)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (ship.tailMode) {
    ctx.save(); ctx.lineCap = 'round'
    for (const offset of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const direction = pose.heading + offset
      const port = rim(direction, 1.6)
      ctx.fillStyle = '#637d8d'; ctx.beginPath(); ctx.arc(port.x, port.y, 2, 0, Math.PI * 2); ctx.fill()
      const weight = Math.max(0, Math.cos(ship.exhaustAngle - direction)) * ship.power
      if (weight < .02) continue
      const tip = rim(direction, 1.6 + weight * 3)
      ctx.strokeStyle = offset === Math.PI ? '#ffb35b' : '#91e9ff'
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(port.x, port.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
    }
    ctx.restore()
  }
  drawHumanoid(ctx, camera, pose, ship.acceleration, false, ship.tailMode ? pose.heading + Math.PI : ship.exhaustAngle, ship.tailMode ? 0 : ship.power)
  ctx.fillStyle = '#fff'
  ctx.font = '12px sans-serif'
  ctx.fillText(ship.name, origin.x + 12, origin.y - 6)
  return { x: origin.x, y: origin.y, depth: pose.y }
}

export function lerpPose(from: Pose, to: Pose, alpha: number): Pose {
  const turn = wrap(to.heading - from.heading)
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    heading: from.heading + turn * alpha,
    vx: from.vx + (to.vx - from.vx) * alpha,
    vy: from.vy + (to.vy - from.vy) * alpha,
  }
}
