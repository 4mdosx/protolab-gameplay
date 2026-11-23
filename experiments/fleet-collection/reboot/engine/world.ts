import { BARRAGES } from '../weapons'
import type {
  Body,
  Command,
  Energy,
  DroneGun,
  Input,
  Motion,
  Pilot,
  Pose,
  Projectile,
  Recoil,
  Ship,
} from '../components'
import { dummyFireSystem, type TrainingDummy } from './dummy'
import { ENERGY, HANDLING } from '../flight-config'
import { SIM_STEP } from './clock'
import { controlSystem } from '../systems/control'
import { motionSystem } from '../systems/motion'
import { gunSystem } from '../systems/gun'
import { citySystem } from '../systems/city'
import { generateCity, type CityMap } from '../../dogfight/city'
import { resolveCharacter } from '../../config'

export type Id = number

export interface World {
  trainingDummies: Map<Id, TrainingDummy>
  energy: Map<Id, Energy>
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
  return world.ids.find((id) => world.pilot.get(id)?.scheme === 'manual')
}

export function lockedTarget(world: World, id: Id): Body | undefined {
  const target = world.input.lockTarget
  if (world.pilot.get(id)?.scheme !== 'manual' || target === undefined || target === id) return
  if ((world.ship.get(target)?.hp ?? 0) > 0) return world.body.get(target)
}

function snapshot(world: World) {
  for (const id of world.ids) {
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    if (!body || !motion) continue
    world.previous.set(id, {
      x: body.x,
      y: body.y,
      heading: body.heading,
      vx: motion.velocity.x,
      vy: motion.velocity.y,
    })
  }
}

/** Apply controls and motion before resolving gunfire. New training rounds travel next tick. */
export function stepWorld(world: World, dt = SIM_STEP) {
  snapshot(world)
  if (!(dt > 0)) return
  controlSystem(world, dt)
  motionSystem(world, dt)
  gunSystem(world, dt, world.previous)
  dummyFireSystem(world, dt)
  citySystem(world)
  world.time = Number((world.time + dt).toFixed(10))
}

export function createWorld(mapSeed = 17): World {
  const world: World = {
    trainingDummies: new Map(),
    energy: new Map(),
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
    input: { reverseControl: true, turn: 0, throttle: 1, aim: null },
    time: 0,
  }
  const hull = resolveCharacter(0)
  const id = world.nextId++
  world.ids.push(id)
  world.ship.set(id, { name: hull.name, hp: 100 })
  world.body.set(id, { x: 15, y: 25, heading: 0, turnRate: 0, turnEffort: 0 })
  world.energy.set(id, { value: ENERGY.capacity, locked: false })
  world.motion.set(id, { velocity: { x: 0, y: 0 }, ...HANDLING.cruiser })
  world.drones.set(
    id,
    ([-1, 1] as const).map((side, index) => ({
      barrage: BARRAGES.cruiser[index],
      cooldown: 0,
      wavesLeft: 0,
      waveTimer: 0,
      name: side === -1 ? '主炮' : '副炮',
      side,
      center: (side * Math.PI) / 6,
      target: 0,
      local: 0,
      arc: (Math.PI * 40) / 180,
      traverse: Math.PI / 3,
      aim: null,
      dead: false,
    })),
  )
  world.pilot.set(id, { scheme: 'manual', thrustAngle: 0 })
  world.command.set(id, { power: 0, thrustAngle: 0, turn: 0 })
  snapshot(world)
  return world
}
