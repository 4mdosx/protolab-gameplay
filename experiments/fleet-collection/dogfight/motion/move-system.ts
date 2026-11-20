import type { TerrainBox } from '../terrain'
import { terrainImpact } from '../terrain'

const DT = 0.1
const RADIUS = 2
const STUCK_SECONDS = 2
const PUSH_MARGIN = 6
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const gap = (point: { x: number; y: number }, box: TerrainBox) => {
  const x = Math.max(box.x, Math.min(point.x, box.x + box.width))
  const y = Math.max(box.y, Math.min(point.y, box.y + box.height))
  return Math.hypot(point.x - x, point.y - y)
}
const surface = (boxes: TerrainBox[]) => boxes.filter(box => box.blocks.includes('surface'))
const touching = (point: { x: number; y: number }, boxes: TerrainBox[], reach: number) => surface(boxes).some(box => gap(point, box) <= reach)

/** Keep the free part of a step. A head-on facade becomes a slide along the wall toward the aim point. */
function slideTo(from: { x: number; y: number }, heading: number, travel: number, aim: { x: number; y: number }, boxes: TerrainBox[], side: number) {
  const dx = Math.cos(heading) * travel, dy = Math.sin(heading) * travel
  const direct = { x: from.x + dx, y: from.y + dy }
  if (terrainImpact(from, direct, 'surface', boxes, RADIUS) === null) return direct
  const partial = (ox: number, oy: number) => {
    const to = { x: from.x + ox, y: from.y + oy }
    const hit = terrainImpact(from, to, 'surface', boxes, RADIUS)
    if (hit === null) return to
    const f = Math.max(0, hit - 0.001)
    return { x: from.x + ox * f, y: from.y + oy * f }
  }
  const alongX = partial(dx, 0), alongY = partial(0, dy)
  const xGain = Math.abs(alongX.x - from.x), yGain = Math.abs(alongY.y - from.y)
  if (Math.max(xGain, yGain) >= travel * 0.35) return xGain >= yGain ? alongX : alongY
  const hx = Math.cos(heading), hy = Math.sin(heading)
  const options = [{ x: -hy, y: hx }, { x: hy, y: -hx }].map(t => {
    const to = { x: from.x + t.x * travel, y: from.y + t.y * travel }
    return { to, blocked: terrainImpact(from, to, 'surface', boxes, RADIUS) !== null, score: distance(to, aim), prefer: Math.sign(-hy * t.x + hx * t.y) === side ? 0 : 1 }
  })
  options.sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.score - b.score || a.prefer - b.prefer || a.to.x - b.to.x)
  return options[0] && !options[0].blocked ? options[0].to : (xGain >= yGain ? alongX : alongY)
}

/** Shortest push that leaves the nearest tower. Tries the other faces when the nearest exit is still inside a building. */
function pushAway(point: { x: number; y: number }, boxes: TerrainBox[]) {
  const box = surface(boxes).filter(b => gap(point, b) <= 3).sort((a, b) => gap(point, a) - gap(point, b) || a.id.localeCompare(b.id))[0]
  if (!box) return null
  const options = [{ x: box.x - PUSH_MARGIN, y: point.y }, { x: box.x + box.width + PUSH_MARGIN, y: point.y }, { x: point.x, y: box.y - PUSH_MARGIN }, { x: point.x, y: box.y + box.height + PUSH_MARGIN }]
  options.sort((a, b) => distance(a, point) - distance(b, point) || a.x - b.x || a.y - b.y)
  const clear = (p: { x: number; y: number }) => surface(boxes).every(b => gap(p, b) > RADIUS)
  return options.find(clear) ?? options[0]
}

/** Body sample the presentation layer is allowed to read. AI writes only intentHeading. */
export interface MoveBody {
  x: number
  y: number
  /** 机体朝向 */
  heading: number
  /** 意图朝向 */
  intentHeading: number
  /** 转向加速度，弧度/秒² */
  acceleration: number
  /** 航速，世界单位/秒 */
  speed: number
  turnRate: number
  maxTurnRate: number
  stuckSince?: number
}

export interface MoveWorld {
  obstacles: TerrainBox[]
  time: number
  dt?: number
  /** Preferred slide side when the hull is still aimed into a wall. */
  side?: number
}

export interface MoveStep {
  x: number
  y: number
  heading: number
  turnRate: number
  speed: number
  stuckSince?: number
  pushed: boolean
}

/** Integrate intent into hull heading, then advance at speed. Collision only changes the resulting position. */
export function moveSystem(body: MoveBody, world: MoveWorld): MoveStep {
  const dt = world.dt ?? DT
  const delta = Math.atan2(Math.sin(body.intentHeading - body.heading), Math.cos(body.intentHeading - body.heading))
  const desiredRate = clamp(delta * 2, -body.maxTurnRate, body.maxTurnRate)
  const turnRate = body.turnRate + clamp(desiredRate - body.turnRate, -body.acceleration * dt, body.acceleration * dt)
  const heading = body.heading + turnRate * dt
  const travel = body.speed * dt
  const aim = { x: body.x + Math.cos(body.intentHeading), y: body.y + Math.sin(body.intentHeading) }
  let next = { x: body.x + Math.cos(heading) * travel, y: body.y + Math.sin(heading) * travel }
  const side = world.side ?? (Math.abs(delta) > 1e-6 ? Math.sign(delta) : 1)
  if (terrainImpact(body, next, 'surface', world.obstacles, RADIUS) !== null) next = slideTo(body, heading, travel, aim, world.obstacles, side)
  const progress = distance(body, next)
  let stuckSince = body.stuckSince
  let pushed = false
  if (body.speed > 0 && progress < 0.25 && touching(body, world.obstacles, 2.5)) {
    const since = stuckSince ?? world.time
    if (world.time - since >= STUCK_SECONDS) {
      const freed = pushAway(body, world.obstacles)
      if (freed) { next = freed; pushed = true }
      stuckSince = undefined
    } else stuckSince = since
  } else stuckSince = undefined
  return { x: next.x, y: next.y, heading, turnRate, speed: body.speed, stuckSince, pushed }
}

/** Destroyer pilot: velocity tracks the command, hull facing tracks separately, then position follows velocity. */
export interface HullBody {
  x: number
  y: number
  heading: number
  velocity: { x: number; y: number }
  desiredVelocity: { x: number; y: number }
  desiredFacing: number
  thrustAccel: number
  maxSpeed: number
  acceleration: number
  turnRate: number
  maxTurnRate: number
  stuckSince?: number
}

export interface HullStep extends MoveStep {
  velocity: { x: number; y: number }
}

export function moveHull(body: HullBody, world: MoveWorld): HullStep {
  const dt = world.dt ?? DT
  const errorX = body.desiredVelocity.x - body.velocity.x
  const errorY = body.desiredVelocity.y - body.velocity.y
  const errorLen = Math.hypot(errorX, errorY)
  const scale = errorLen < 1e-6 ? 0 : Math.min(1, body.thrustAccel * dt / errorLen)
  const velocity = { x: body.velocity.x + errorX * scale, y: body.velocity.y + errorY * scale }
  const delta = Math.atan2(Math.sin(body.desiredFacing - body.heading), Math.cos(body.desiredFacing - body.heading))
  const desiredRate = clamp(delta * 2, -body.maxTurnRate, body.maxTurnRate)
  const turnRate = body.turnRate + clamp(desiredRate - body.turnRate, -body.acceleration * dt, body.acceleration * dt)
  const heading = body.heading + turnRate * dt
  const aim = { x: body.x + body.desiredVelocity.x, y: body.y + body.desiredVelocity.y }
  let next = { x: body.x + velocity.x * dt, y: body.y + velocity.y * dt }
  const side = world.side ?? (Math.abs(delta) > 1e-6 ? Math.sign(delta) : 1)
  let resolved = velocity
  if (terrainImpact(body, next, 'surface', world.obstacles, RADIUS) !== null) {
    const travel = Math.max(Math.hypot(velocity.x, velocity.y) * dt, 1e-4)
    const moveHeading = Math.atan2(velocity.y, velocity.x)
    next = slideTo(body, moveHeading, travel, aim, world.obstacles, side)
    resolved = { x: (next.x - body.x) / dt, y: (next.y - body.y) / dt }
  }
  const progress = distance(body, next)
  let stuckSince = body.stuckSince
  let pushed = false
  if (body.maxSpeed > 0 && progress < 0.25 && touching(body, world.obstacles, 2.5)) {
    const since = stuckSince ?? world.time
    if (world.time - since >= STUCK_SECONDS) {
      const freed = pushAway(body, world.obstacles)
      if (freed) { next = freed; pushed = true; resolved = { x: 0, y: 0 } }
      stuckSince = undefined
    } else stuckSince = since
  } else stuckSince = undefined
  return { x: next.x, y: next.y, heading, turnRate, speed: Math.hypot(resolved.x, resolved.y), velocity: resolved, stuckSince, pushed }
}
