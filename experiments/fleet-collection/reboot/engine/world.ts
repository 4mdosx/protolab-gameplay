import type { Body, Command, DroneGun, Input, Motion, Pilot, Pose, Projectile, Recoil, Ship } from '../components'
import { HANDLING } from '../handling'
import { SIM_STEP } from './clock'
import { controlSystem } from '../systems/control'
import { motionSystem } from '../systems/motion'
import { gunSystem } from '../systems/gun'
import { citySystem } from '../systems/city'
import { generateCity, type CityMap } from '../../dogfight/city'
import { resolveCharacter } from '../../config'

export type Id = number

export interface World {
  recoil: Map<Id, Recoil[]>
  projectiles: Projectile[]
  nextId: Id
  ids: Id[]
  ship: Map<Id, Ship>
  body: Map<Id, Body>
  motion: Map<Id, Motion>
  drones: Map<Id, DroneGun[]>
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
    if (!body || !motion) continue
    world.previous.set(id, { x: body.x, y: body.y, heading: body.heading, vx: motion.velocity.x, vy: motion.velocity.y })
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
    recoil: new Map(),
    projectiles: [],
    nextId: 1,
    ids: [],
    ship: new Map(),
    body: new Map(),
    motion: new Map(),
    drones: new Map(),
    pilot: new Map(),
    command: new Map(),
    previous: new Map(),
    city: generateCity(mapSeed),
    input: { reverseControl: true, turn: 0, throttle: 0, aim: null },
    time: 0,
  }
  const hull = resolveCharacter(0)
  const id = world.nextId++
  world.ids.push(id)
  world.ship.set(id, { name: hull.name })
  world.body.set(id, { x: 15, y: 25, heading: 0, turnRate: 0, turnEffort: 0 })
  world.motion.set(id, { velocity: { x: 0, y: 0 }, ...HANDLING.cruiser })
  world.drones.set(id, ([-1, 1] as const).map(side => ({ weaponClass: 'cruiser', cooldown: 0, wavesLeft: 0, waveTimer: 0, name: side === -1 ? '主炮' : '副炮', side, center: side * Math.PI / 6, target: 0, local: 0, arc: Math.PI * 40 / 180, traverse: Math.PI / 3, aim: null, dead: false })))
  world.pilot.set(id, { scheme: 'manual' })
  world.command.set(id, { power: 0, thrustAngle: 0, turn: 0 })
  snapshot(world)
  return world
}
