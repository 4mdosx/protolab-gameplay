import { HULL_RADIUS } from '../flight-config'
import type { World, Id } from './world'
import { terrainImpact } from '../../dogfight/terrain'

export interface TrainingDummy {
  target: Id
  firing: boolean
  reload: number
}

/** Stationary target shares ordinary hull hit detection. */
export function spawnDummy(world: World, near: Id): Id {
  const origin = world.body.get(near)!
  let position = { x: origin.x + 25, y: origin.y }
  for (let i = 0; i < 72; i++) {
    const angle = (i * Math.PI) / 36
    const candidate = { x: origin.x + Math.cos(angle) * 25, y: origin.y + Math.sin(angle) * 25 }
    if (terrainImpact(origin, candidate, 'surface', world.city.buildings, HULL_RADIUS) === null) {
      position = candidate
      break
    }
  }
  // Fall back to a clear stationary location if no direct firing lane exists.
  if (terrainImpact(position, position, 'surface', world.city.buildings, HULL_RADIUS) !== null)
    position = { x: origin.x, y: origin.y + 6 }
  const id = world.nextId++
  world.ids.push(id)
  world.ship.set(id, { name: '敌方训练木桩', hp: 100 })
  world.body.set(id, { ...position, heading: Math.PI, turnRate: 0, turnEffort: 0 })
  world.trainingDummies.set(id, { target: near, firing: false, reload: 0 })
  return id
}

export function resetDummy(world: World, id: Id) {
  const ship = world.ship.get(id)
  if (ship) ship.hp = 100
  const dummy = world.trainingDummies.get(id)
  if (dummy) dummy.reload = 0
  // Clear old rounds so resetting cannot immediately take damage from the previous volley.
  world.projectiles = []
}

const FIRE_INTERVAL = 1.6
const ROUND_SPEED = 34
const ROUND_RADIUS = 0.45

/** Fire ordinary ballistic rounds on the simulation clock. */
export function dummyFireSystem(world: World, dt: number) {
  if (!(dt > 0)) return
  for (const [id, dummy] of world.trainingDummies) {
    const body = world.body.get(id)
    const target = world.body.get(dummy.target)
    if (!dummy.firing || !body || !target) continue
    if ((world.ship.get(id)?.hp ?? 0) <= 0 || (world.ship.get(dummy.target)?.hp ?? 0) <= 0) continue
    dummy.reload = Math.max(0, dummy.reload - dt)
    if (dummy.reload > 1e-8) continue
    const dx = target.x - body.x,
      dy = target.y - body.y
    const range = Math.hypot(dx, dy)
    if (range < 3 || range > ROUND_SPEED * 3) continue
    const vx = dx / range,
      vy = dy / range
    const muzzle = { x: body.x + vx * 2.5, y: body.y + vy * 2.5 }
    if (terrainImpact(body, muzzle, 'surface', world.city.buildings, ROUND_RADIUS) !== null)
      continue
    world.projectiles.push({
      ...muzzle,
      vx: vx * ROUND_SPEED,
      vy: vy * ROUND_SPEED,
      radius: ROUND_RADIUS,
      life: 3,
      owner: id,
      weapon: 1,
    })
    dummy.reload = FIRE_INTERVAL
  }
}
