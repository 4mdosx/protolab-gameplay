import { BRAKE } from '../flight-config'
import type { Camera } from '../../dogfight/camera'
import type { Id, World } from '../engine/world'
import { drawBuilding, drawTerrain, type Facade } from './city'
import { drawShip, lerpPose } from './ship'
import { flightPoint } from '../../dogfight/projection'
import { worldToScreen } from './view'
import { drawDrones } from './drones'
import { drawExhaust } from './exhaust'
import { SIM_STEP } from '../engine/clock'

const reactions = new WeakMap<World, Map<Id, { time: number; x: number; y: number }>>()

function overlaps(face: Facade, x: number, y: number) {
  return x > face.x - 14 && x < face.x + face.w + 14 && y > face.y - 14 && y < face.y + face.h + 14
}

/** Terrain first, then buildings and the ship in depth order. A facade in front keeps the hull outline. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  id: Id,
  alpha: number,
) {
  drawTerrain(ctx, camera, world.city)
  const body = world.body.get(id)
  const motion = world.motion.get(id)
  const ship = world.ship.get(id)
  const previous = world.previous.get(id)
  if (!body || !motion || !ship || !previous) return
  const command = world.command.get(id)
  const braking = command?.brakeFraction !== undefined && Math.hypot(motion.velocity.x, motion.velocity.y) > BRAKE.minSpeed
  const thrustAngle = command?.step?.angle ?? command?.appliedThrustAngle ?? body.heading
  const exhaustAngle = braking ? Math.atan2(motion.velocity.y, motion.velocity.x) : thrustAngle + Math.PI
  const nozzlePower = braking ? BRAKE.thrustMultiplier * command.brakeFraction! : command?.step?.power ?? command?.power ?? 0
  // Sustain the attitude jets during a committed turn, even at steady angular speed.
  const recenterThrust = command?.recentering ? Math.sign(command.turn || body.turnRate) * 0.4 : 0
  const turnEffort = Math.abs(body.turnEffort) > 0.05 ? body.turnEffort : recenterThrust
  const pose = lerpPose(
    previous,
    { x: body.x, y: body.y, heading: body.heading, vx: motion.velocity.x, vy: motion.velocity.y },
    alpha,
  )
  const renderTime = Math.max(0, world.time - SIM_STEP + alpha * SIM_STEP)
  let states = reactions.get(world)
  if (!states) {
    states = new Map()
    reactions.set(world, states)
  }
  const reaction = states.get(id) ?? { time: renderTime, x: 0, y: 0 }
  const blend = 1 - Math.exp(-12 * Math.max(0, Math.min(0.1, renderTime - reaction.time)))
  reaction.x += ((motion.velocity.x - previous.vx) / SIM_STEP - reaction.x) * blend
  reaction.y += ((motion.velocity.y - previous.vy) / SIM_STEP - reaction.y) * blend
  reaction.time = renderTime
  states.set(id, reaction)
  for (const box of world.city.buildings) if (box.kind !== 'tower') drawBuilding(ctx, camera, box)
  drawExhaust(ctx, camera, world, id, pose, Math.max(0, world.time - SIM_STEP + alpha * SIM_STEP))
  const towers = world.city.buildings.filter((box) => box.kind === 'tower')
  const targets = world.ids.filter(
    (other) => other !== id && world.body.has(other) && world.ship.has(other),
  )
  const order = [
    ...towers.map((box) => ({ depth: box.y + box.height, box, unit: id })),
    { depth: pose.y, box: null, unit: id },
    ...targets.map((unit) => ({ depth: world.body.get(unit)!.y, box: null, unit })),
  ].sort((a, b) => a.depth - b.depth)
  const facades: Facade[] = []
  let mark: { x: number; y: number; depth: number } | null = null
  for (const item of order) {
    if (item.box) {
      const facade = drawBuilding(ctx, camera, item.box)
      if (facade) facades.push(facade)
    } else if (item.unit !== id) {
      const target = world.body.get(item.unit)!,
        info = world.ship.get(item.unit)!
      ctx.save()
      if (info.hp <= 0) ctx.globalAlpha = 0.3
      drawShip(ctx, camera, {
        pose: { ...target, vx: 0, vy: 0 },
        acceleration: { x: 0, y: 0 },
        power: 0,
        turnEffort: 0,
        thrustAngle: target.heading,
        exhaustAngle: target.heading + Math.PI,
        name: `${info.name} · ${info.hp <= 0 ? '已击破' : 'HP ' + info.hp}`,
      })
      const p = flightPoint(
        worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, target),
        camera.scale,
      )
      if (world.input.lockTarget === item.unit && info.hp > 0) {
        ctx.strokeStyle = command?.bd ? '#ffda80' : '#69d5d4'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 19, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = '#402b33'
      ctx.fillRect(p.x - 20, p.y - 24, 40, 4)
      ctx.fillStyle = '#ff8d7a'
      ctx.fillRect(p.x - 20, p.y - 24, (40 * info.hp) / 100, 4)
      ctx.restore()
    } else {
      drawDrones(ctx, camera, world, id, pose)
      mark = drawShip(ctx, camera, {
        pose,
        acceleration: reaction,
        turnEffort,
        name: ship.name,
        thrustAngle,
        exhaustAngle,
        power: nozzlePower,
      })
    }
  }
  ctx.save()
  for (const shot of world.projectiles) {
    ctx.strokeStyle = shot.owner === id ? '#ffe6a0' : '#ff8d80'
    const at = (x: number, y: number) =>
      flightPoint(
        worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, { x, y }),
        camera.scale,
      )
    ctx.lineWidth = shot.radius * camera.scale * 2
    ctx.lineCap = 'round'
    const head = at(shot.x, shot.y)
    const tail = at(shot.x - shot.vx * 0.035, shot.y - shot.vy * 0.035)
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(head.x, head.y)
    ctx.stroke()
  }
  ctx.restore()
  const pilot = world.pilot.get(id)
  const course = command?.bd ? pilot?.bdCourse : undefined
  const recenter = command?.recentering ? pilot?.recenterAngle : undefined
  const desired = course ?? recenter
  if (desired !== undefined) {
    const speed = Math.hypot(pose.vx, pose.vy)
    const alignment = speed > 1
      ? (pose.vx * Math.cos(desired) + pose.vy * Math.sin(desired)) / speed
      : 0
    const opacity = course === undefined ? 0.85 : Math.min(0.85, (1 - alignment) * 10)
    const start = course === undefined
      ? { x: pose.x + Math.cos(pose.heading) * 2.4, y: pose.y + Math.sin(pose.heading) * 2.4 }
      : pose
    const end = { x: start.x + Math.cos(desired) * 12, y: start.y + Math.sin(desired) * 12 }
    const project = (point: { x: number; y: number }) =>
      flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, point), camera.scale)
    const from = project(start)
    const to = project(end)
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.strokeStyle = course === undefined ? '#a5e9ff' : '#ffda80'
    ctx.lineWidth = 2
    ctx.setLineDash(course === undefined ? [2, 4] : [7, 4])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.restore()
  }
  if (!mark) return
  const placed = mark
  const hidden = facades.some(
    (face) => face.depth > placed.depth && overlaps(face, placed.x, placed.y),
  )
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
