import type { Duel, Vec } from './types'
import { arcRim } from './arc'

export interface Camera { x: number; y: number; scale: number }

export function frameCamera(points: Vec[], width: number, height: number): Camera {
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    scale: Math.min(8, width / Math.max(80, maxX - minX + 90), height / Math.max(60, maxY - minY + 90)),
  }
}

function project(point: Vec, camera: Camera, width: number, height: number) {
  return {
    x: width / 2 + (point.x - camera.x) * camera.scale,
    y: height / 2 + (point.y - camera.y) * camera.scale * 0.78,
  }
}

/** Draw the cone that inArc accepts, by projecting its world-space rim. */
export function drawDuel(ctx: CanvasRenderingContext2D, duel: Duel, camera: Camera) {
  const { width, height } = ctx.canvas
  const at = (point: Vec) => project(point, camera, width, height)
  ctx.fillStyle = '#112635'
  ctx.fillRect(0, 0, width, height)
  for (const shot of duel.shots) {
    const head = at(shot)
    const tail = at({ x: shot.x - shot.vx * 0.08, y: shot.y - shot.vy * 0.08 })
    ctx.strokeStyle = shot.team === 'blue' ? '#8afbf0' : '#ff9b83'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(head.x, head.y)
    ctx.lineTo(tail.x, tail.y)
    ctx.stroke()
  }
  for (const ship of duel.hulls) {
    if (ship.hp <= 0) continue
    const color = ship.team === 'blue' ? '#69d5d4' : '#f08b83'
    const origin = at(ship)
    const rim = arcRim(ship).map(at)
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    for (const point of rim) ctx.lineTo(point.x, point.y)
    ctx.closePath()
    ctx.fillStyle = ship.team === 'blue' ? '#69d5d422' : '#f08b8322'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()
    const nose = at({ x: ship.x + Math.cos(ship.heading) * 14, y: ship.y + Math.sin(ship.heading) * 14 })
    const left = at({ x: ship.x + Math.cos(ship.heading + 2.4) * 8, y: ship.y + Math.sin(ship.heading + 2.4) * 8 })
    const right = at({ x: ship.x + Math.cos(ship.heading - 2.4) * 8, y: ship.y + Math.sin(ship.heading - 2.4) * 8 })
    ctx.beginPath()
    ctx.moveTo(nose.x, nose.y)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    const speed = at({ x: ship.x + ship.velocity.x * 0.7, y: ship.y + ship.velocity.y * 0.7 })
    ctx.strokeStyle = '#f4fff8'
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.lineTo(speed.x, speed.y)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${ship.name} ${Math.ceil(ship.hp)}`, origin.x + 10, origin.y - 8)
  }
}
