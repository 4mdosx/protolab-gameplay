import type { Camera } from '../../dogfight/camera'
import type { Id, World } from '../engine/world'
import { drawBuilding, drawTerrain, type Facade } from './city'
import { drawShip, lerpPose } from './ship'

function overlaps(face: Facade, x: number, y: number) {
  return x > face.x - 14 && x < face.x + face.w + 14 && y > face.y - 14 && y < face.y + face.h + 14
}

/** Terrain first, then buildings and the ship in depth order. A facade in front keeps the hull outline. */
export function drawFrame(ctx: CanvasRenderingContext2D, world: World, camera: Camera, id: Id, alpha: number) {
  drawTerrain(ctx, camera, world.city)
  const body = world.body.get(id)
  const motion = world.motion.get(id)
  const gun = world.gun.get(id)
  const ship = world.ship.get(id)
  const previous = world.previous.get(id)
  if (!body || !motion || !gun || !ship || !previous) return
  const pose = lerpPose(previous, { x: body.x, y: body.y, heading: body.heading, vx: motion.velocity.x, vy: motion.velocity.y, gun: gun.local, dead: gun.dead, aim: gun.aim }, alpha)
  for (const box of world.city.buildings) if (box.kind !== 'tower') drawBuilding(ctx, camera, box)
  const towers = world.city.buildings.filter(box => box.kind === 'tower')
  const order = [...towers.map(box => ({ depth: box.y + box.height, box })), { depth: pose.y, box: null }].sort((a, b) => a.depth - b.depth)
  const facades: Facade[] = []
  let mark: { x: number; y: number; depth: number } | null = null
  for (const item of order) {
    if (item.box) {
      const facade = drawBuilding(ctx, camera, item.box)
      if (facade) facades.push(facade)
    } else mark = drawShip(ctx, camera, { pose, arc: gun.arc, name: ship.name })
  }
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
