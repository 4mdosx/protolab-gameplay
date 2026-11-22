import { applyHandling, type HandlingId } from '../experiments/fleet-collection/reboot/handling'
import { motionSystem } from '../experiments/fleet-collection/reboot/systems/motion'
import { describe, expect, it } from 'vitest'
import { advance, createClock, SIM_STEP } from '../experiments/fleet-collection/reboot/engine/clock'
import { createWorld, manualShip, stepWorld } from '../experiments/fleet-collection/reboot/engine/world'
import { terrainImpact } from '../experiments/fleet-collection/dogfight/terrain'

describe('reboot clock', () => {
  it('turns real time into fixed steps and keeps the leftover as the render fraction', () => {
    const advanced = advance(createClock(), 0.25)
    expect(advanced.steps).toBe(2)
    expect(advanced.clock.time).toBeCloseTo(SIM_STEP * 2)
    expect(advanced.alpha).toBeCloseTo(0.5)
  })
})

describe('reboot destroyer', () => {
  it('spawns one manual destroyer on a clear street', () => {
    const world = createWorld(17)
    const id = manualShip(world)
    expect(id).toBeTypeOf('number')
    const body = world.body.get(id!)!
    expect(world.ship.get(id!)!.name).toBe('晴岚')
    expect(world.city.buildings.length).toBeGreaterThan(0)
    expect(terrainImpact(body, { x: body.x + 1, y: body.y }, 'surface', world.city.buildings, 2)).toBeNull()
  })

  it('accelerates toward the pointer under thrust', () => {
    const world = createWorld(17)
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { reverseControl: true, turn: 0, throttle: 3, aim: { x: body.x + 40, y: body.y } }
    stepWorld(world)
    const motion = world.motion.get(id)!
    expect(motion.velocity.x).toBeGreaterThan(1)
    expect(Math.abs(body.heading)).toBeLessThan(0.05)
    expect(body.x).toBeGreaterThan(15)
  })

  it('points exhaust at the mouse by default and flips acceleration with reverse control', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { reverseControl: false, turn: 0, throttle: 3, aim: { x: body.x + 100, y: body.y } }
    stepWorld(world)
    expect(world.motion.get(id)!.velocity.x).toBeLessThan(0)
    world.motion.get(id)!.velocity = { x: 0, y: 0 }
    world.input.reverseControl = true
    stepWorld(world)
    expect(world.motion.get(id)!.velocity.x).toBeGreaterThan(0)
    expect(body.heading).toBe(0)
  })

  it('steers the hull independently of thrust and brakes angular motion on release', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { reverseControl: true, turn: 1, throttle: 3, aim: { x: body.x + 1000, y: body.y } }
    for (let i = 0; i < 10; i++) stepWorld(world)
    expect(body.heading).toBeGreaterThan(0.4)
    expect(world.motion.get(id)!.velocity.x).toBeGreaterThan(0)
    expect(world.motion.get(id)!.velocity.y).toBeGreaterThan(0)
    world.input.turn = 0
    for (let i = 0; i < 10; i++) stepWorld(world)
    expect(body.turnRate).toBeCloseTo(0)
  })

  it('only steers selected drones, obeying traverse speed and arc limits', () => {
    const world = createWorld(17)
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { selectedGun: 1, reverseControl: false, turn: 0, throttle: 0, aim: { x: body.x - 100, y: body.y - 4.5 } }
    stepWorld(world)
    const [first, second] = world.drones.get(id)!
    expect(Math.abs(first.local)).toBeCloseTo(first.traverse * SIM_STEP)
    expect(second.local).toBeCloseTo(0)
    expect(first.name).toBe('主炮')
    expect(first.arc).toBeCloseTo(40 * Math.PI / 180)
    expect(first.center).toBeCloseTo(-Math.PI / 6)
    expect(second.center).toBeCloseTo(Math.PI / 6)
    expect((first.center + first.arc) - (second.center - second.arc)).toBeCloseTo(20 * Math.PI / 180)
    for (let i = 0; i < 40; i++) stepWorld(world)
    expect(first.dead).toBe(true)
    expect(first.local).toBeCloseTo(first.center - first.arc)
    world.input.selectedGun = 0
    world.input.aim = { x: body.x + 100, y: body.y }
    stepWorld(world)
    expect(first.local).toBeCloseTo(first.center - first.arc)
  })

  it('locks world thrust direction while selecting or switching weapons', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    world.input = { reverseControl: true, turn: 0, throttle: 2, aim: { x: 100, y: 25 } }
    stepWorld(world)
    const angle = world.command.get(id)!.thrustAngle
    world.input.selectedGun = 1
    world.input.aim = { x: -100, y: 100 }
    world.input.turn = 1
    stepWorld(world)
    expect(world.command.get(id)!.thrustAngle).toBe(angle)
    world.input.selectedGun = 2
    stepWorld(world)
    expect(world.command.get(id)!.thrustAngle).toBe(angle)
    world.input.selectedGun = 0
    stepWorld(world)
    expect(world.command.get(id)!.thrustAngle).not.toBe(angle)
  })

  it('fires class barrages with independent reload and larger battleship hitboxes', () => {
    for (const [profile, total, radius] of [['destroyer', 4, .45], ['cruiser', 6, .65], ['battleship', 9, 1]] as const) {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      applyHandling(world, id, profile)
      world.input.fireQueue = [1]
      for (let i = 0; i < 12; i++) stepWorld(world)
      expect(world.projectiles).toHaveLength(total)
      expect(world.projectiles.every(shot => shot.weapon === 1 && shot.radius === radius)).toBe(true)
      expect(world.drones.get(id)![0].cooldown).toBeGreaterThan(0)
      world.input.fireQueue = [1]
      stepWorld(world)
      expect(world.projectiles).toHaveLength(total)
      world.input.fireQueue = [2]
      stepWorld(world)
      expect(world.projectiles.length).toBeGreaterThan(total)
      if (profile === 'battleship') {
        const angles = world.projectiles.slice(0, 3).map(shot => Math.atan2(shot.vy, shot.vx))
        expect(angles[0]).toBeLessThan(angles[1]); expect(angles[1]).toBeLessThan(angles[2])
      }
    }
    const world = createWorld(17)
    world.city.buildings = []
    world.input.fireQueue = [0]
    stepWorld(world)
    expect(world.projectiles.map(shot => shot.weapon)).toEqual([1, 1, 2, 2])
  })

  it('adds bounded lateral grip without generating energy in neutral', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const body = world.body.get(id)!
    const motion = world.motion.get(id)!
    body.heading = Math.PI / 4
    motion.velocity = { x: 30, y: 0 }
    motion.drag = 0
    motionSystem(world, 0.1)
    expect(motion.velocity.y).toBeGreaterThan(0)
    expect(Math.hypot(motion.velocity.x, motion.velocity.y)).toBeLessThan(30)
    expect(Math.hypot(motion.velocity.x - 30, motion.velocity.y)).toBeLessThanOrEqual(motion.maxLateralAccel * 0.1 + 1e-6)
  })

  it('changes force rather than clamping speed when downshifting and reverses attitude jets to brake', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const motion = world.motion.get(id)!
    world.input = { reverseControl: true, turn: 1, throttle: 3, aim: { x: 1000, y: 25 } }
    stepWorld(world)
    expect(world.body.get(id)!.turnEffort).toBeGreaterThan(0)
    motion.velocity = { x: 30, y: 0 }
    world.input.turn = 0
    world.input.throttle = 1
    stepWorld(world)
    expect(world.command.get(id)!.power).toBe(0.1)
    expect(Math.hypot(motion.velocity.x, motion.velocity.y)).toBeGreaterThan(20)
    expect(world.body.get(id)!.turnEffort).toBeLessThan(0)
  })

  it('makes light destroyers more responsive and battleships heavier without resetting movement', () => {
    const response = (profile: HandlingId) => {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      world.motion.get(id)!.velocity = { x: 1, y: 0 }
      const x = world.body.get(id)!.x
      applyHandling(world, id, profile)
      expect(world.motion.get(id)!.velocity.x).toBe(1)
      expect(world.body.get(id)!.x).toBe(x)
      world.input = { reverseControl: true, turn: 1, throttle: 3, aim: { x: 1000, y: 25 } }
      stepWorld(world)
      return { speed: world.motion.get(id)!.velocity.x, yaw: world.body.get(id)!.turnRate }
    }
    const light = response('destroyer'), standard = response('cruiser'), heavy = response('battleship')
    expect(light.speed).toBeGreaterThan(standard.speed)
    expect(standard.speed).toBeGreaterThan(heavy.speed)
    expect(light.yaw).toBeGreaterThan(standard.yaw)
    expect(standard.yaw).toBeGreaterThan(heavy.yaw)
  })

  it('applies recoil over time, sums salvos and stops acceleration when pulses expire', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const motion = world.motion.get(id)!
    motion.drag = 0; motion.lateralGrip = 0
    world.input.fireQueue = [0]
    stepWorld(world)
    expect(world.recoil.get(id)).toHaveLength(2)
    const pulses = world.recoil.get(id)!
    const force = pulses.reduce((sum, pulse) => sum + pulse.fx, 0)
    expect(force).toBeLessThan(0)
    motionSystem(world, 0.1)
    const firstSpeed = motion.velocity.x
    expect(firstSpeed).toBeCloseTo(force / motion.mass * 0.1)
    motionSystem(world, 0.1)
    expect(motion.velocity.x).toBeLessThan(firstSpeed)
    motionSystem(world, 0.1)
    expect(world.recoil.get(id)).toHaveLength(0)
    expect(motion.velocity.x).toBeCloseTo(force / motion.mass * 0.22)
    const coast = motion.velocity.x
    motionSystem(world, 0.1)
    expect(motion.velocity.x).toBeCloseTo(coast)
  })

  it('does not sail through a tower', () => {
    const world = createWorld(17)
    const tower = world.city.buildings.find(box => box.kind === 'tower')
    expect(tower).toBeTruthy()
    const id = manualShip(world)!
    const body = world.body.get(id)!
    body.x = tower!.x - 3
    body.y = tower!.y + tower!.height / 2
    body.heading = 0
    world.input = { reverseControl: true, turn: 0, throttle: 3, aim: { x: body.x + 100, y: body.y } }
    for (let i = 0; i < 30; i++) stepWorld(world)
    expect(body.x).toBeLessThan(tower!.x - 1.5)
  })
})
