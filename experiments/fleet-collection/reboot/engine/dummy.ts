import type { World, Id } from './world'
import { terrainImpact } from '../../dogfight/terrain'

/** Stationary target shares ordinary hull hit detection; it has no movement controller. */
export function spawnDummy(world: World, near: Id): Id {
  const origin = world.body.get(near)!
  let position = { x: origin.x + 25, y: origin.y }
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI / 36
    const candidate = { x: origin.x + Math.cos(angle) * 25, y: origin.y + Math.sin(angle) * 25 }
    if (terrainImpact(origin, candidate, 'surface', world.city.buildings, 2) === null) { position = candidate; break }
  }
  // Fall back to a clear stationary location if no direct firing lane exists.
  if (terrainImpact(position, position, 'surface', world.city.buildings, 2) !== null) position = { x: origin.x, y: origin.y + 6 }
  const id = world.nextId++
  world.ids.push(id)
  world.ship.set(id, { name: '敌方训练木桩', hp: 100 })
  world.body.set(id, { ...position, heading: Math.PI, turnRate: 0, turnEffort: 0 })
  return id
}

export function resetDummy(world: World, id: Id) {
  const ship = world.ship.get(id)
  if (ship) ship.hp = 100
  // Clear old rounds so resetting cannot immediately take damage from the previous volley.
  world.projectiles = []
}
