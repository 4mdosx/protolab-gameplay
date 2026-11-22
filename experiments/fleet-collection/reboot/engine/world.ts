import type { Body, Command, Gun, Input, Motion, Pilot, Pose, Ship } from '../components'
import { SIM_STEP } from './clock'
import { controlSystem } from '../systems/control'
import { motionSystem } from '../systems/motion'
import { gunSystem } from '../systems/gun'
import { citySystem } from '../systems/city'
import { generateCity, type CityMap } from '../../dogfight/city'
import { resolveCharacter } from '../../config'

export type Id = number

export interface World {
  nextId: Id
  ids: Id[]
  ship: Map<Id, Ship>
  body: Map<Id, Body>
  motion: Map<Id, Motion>
  gun: Map<Id, Gun>
  pilot: Map<Id, Pilot>
  command: Map<Id, Command>
  previous: Map<Id, Pose>
  city: CityMap
  input: Input
  time: number
}

export function manualShip(world: World): Id | undefined {
  return world.ids.find(id => world.pilot.get(id)?.scheme === 'manual')
}

function snapshot(world: World) {
  for (const id of world.ids) {
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    const gun = world.gun.get(id)
    if (!body || !motion || !gun) continue
    world.previous.set(id, { x: body.x, y: body.y, heading: body.heading, vx: motion.velocity.x, vy: motion.velocity.y, gun: gun.local, dead: gun.dead, aim: gun.aim })
  }
}

/** Control, then motion, then the gun, then the map. Each system writes its own components. */
export function stepWorld(world: World, dt = SIM_STEP) {
  snapshot(world)
  controlSystem(world)
  motionSystem(world, dt)
  gunSystem(world, dt)
  citySystem(world)
  world.time = Math.round((world.time + dt) * 10) / 10
}

export function createWorld(mapSeed = 17): World {
  const world: World = {
    nextId: 1,
    ids: [],
    ship: new Map(),
    body: new Map(),
    motion: new Map(),
    gun: new Map(),
    pilot: new Map(),
    command: new Map(),
    previous: new Map(),
    city: generateCity(mapSeed),
    input: { x: 0, y: 0, aim: null },
    time: 0,
  }
  const hull = resolveCharacter(0)
  const mount = hull.weaponSlots.find(slot => slot.weapon.arc && slot.weapon.traverse)
  if (!mount?.weapon.arc || !mount.weapon.traverse) throw new Error('destroyer main gun has no arc')
  const id = world.nextId++
  world.ids.push(id)
  world.ship.set(id, { name: hull.name })
  world.body.set(id, { x: 15, y: 25, heading: 0, turnRate: 0 })
  world.motion.set(id, { velocity: { x: 0, y: 0 }, cruise: hull.speed * 3, thrust: 18 })
  world.gun.set(id, { arc: mount.weapon.arc, traverse: mount.weapon.traverse, local: 0, aim: null, dead: false })
  world.pilot.set(id, { scheme: 'manual' })
  world.command.set(id, { velocity: { x: 0, y: 0 }, facing: 0, aim: null })
  snapshot(world)
  return world
}
