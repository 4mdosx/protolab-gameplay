import type { Camera } from '../../dogfight/camera'
import type { Id, World } from '../engine/world'
import { drawBuilding, drawTerrain, type Facade } from './city'
import { drawShip, lerpPose } from './ship'
import { flightPoint } from '../../dogfight/projection'
import { worldToScreen } from './view'
import { drawDrones } from './drones'
import { drawExhaust } from './exhaust'
import { SIM_STEP } from '../engine/clock'

function overlaps(face: Facade, x: number, y: number) {
  return x > face.x - 14 && x < face.x + face.w + 14 && y > face.y - 14 && y < face.y + face.h + 14
}

/** Terrain first, then buildings and the ship in depth order. A facade in front keeps the hull outline. */
export function drawFrame(ctx: CanvasRenderingContext2D, world: World, camera: Camera, id: Id, alpha: number) {
  drawTerrain(ctx, camera, world.city)
  const body = world.body.get(id)
  const motion = world.motion.get(id)
  const ship = world.ship.get(id)
  const previous = world.previous.get(id)
  if (!body || !motion || !ship || !previous) return
  const pose = lerpPose(previous, { x: body.x, y: body.y, heading: body.heading, vx: motion.velocity.x, vy: motion.velocity.y }, alpha)
  for (const box of world.city.buildings) if (box.kind !== 'tower') drawBuilding(ctx, camera, box)
  drawExhaust(ctx, camera, world, id, pose, Math.max(0, world.time - SIM_STEP + alpha * SIM_STEP))
  const towers = world.city.buildings.filter(box => box.kind === 'tower')
  const order = [...towers.map(box => ({ depth: box.y + box.height, box })), { depth: pose.y, box: null }].sort((a, b) => a.depth - b.depth)
  const facades: Facade[] = []
  let mark: { x: number; y: number; depth: number } | null = null
  for (const item of order) {
    if (item.box) {
      const facade = drawBuilding(ctx, camera, item.box)
      if (facade) facades.push(facade)
    } else {
      drawDrones(ctx, camera, world, id, pose)
      mark = drawShip(ctx, camera, { pose, turnEffort: body.turnEffort, name: ship.name, thrustAngle: world.command.get(id)?.thrustAngle ?? 0, power: world.command.get(id)?.power ?? 0 })
    }
  }
  ctx.save()
  ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = 2.5
  for (const shot of world.projectiles) {
    const at = (x: number, y: number) => flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, { x, y }), camera.scale)
    ctx.lineWidth = shot.radius * camera.scale * 2
    ctx.lineCap = 'round'
    const head = at(shot.x, shot.y)
    const tail = at(shot.x - shot.vx * 0.035, shot.y - shot.vy * 0.035)
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke()
  }
  ctx.restore()
  if (!mark) return
  const placed = mark
  const hidden = facades.some(face => face.depth > placed.depth && overlaps(face, placed.x, placed.y))
  if (!hidden) return
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = '#f4fff8'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(placed.x, placed.y, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#69d5d4'
  ctx.font = '12px sans-serif'
  ctx.fillText(ship.name, placed.x + 12, placed.y - 6)
  ctx.restore()
}
