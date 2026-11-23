import { spawnDummy, resetDummy } from '../experiments/fleet-collection/reboot/engine/dummy'
import { cameraScaleForSpeed, followCamera, screenToWorld, worldToScreen } from '../experiments/fleet-collection/reboot/render/view'
import { gunSystem } from '../experiments/fleet-collection/reboot/systems/gun'
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
    motion.drag = 0; motion.sideDrag = 0
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
    motion.drag = 0; motion.sideDrag = 0; motion.lateralGrip = 0
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

  it('passive drag preserves forward glide better than broadside motion without adding energy', () => {
    const coast = (heading: number) => {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      const motion = world.motion.get(id)!
      world.body.get(id)!.heading = heading
      motion.lateralGrip = 0
      motion.velocity = { x: 30, y: 0 }
      for (let i = 0; i < 10; i++) motionSystem(world, 0.1)
      return Math.hypot(motion.velocity.x, motion.velocity.y)
    }
    const forward = coast(0), broadside = coast(Math.PI / 2)
    expect(forward).toBeLessThan(30)
    expect(broadside).toBeLessThan(forward)
    expect(forward).toBeCloseTo(30 / (1 + (216 / 45 ** 2) / 12 * 30), 5)
  })

  it('brakes to rest without reversing and consumes energy only while slowing', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    world.motion.get(id)!.velocity = { x: 5, y: 0 }
    world.input.brake = true
    world.input.throttle = 3
    stepWorld(world)
    expect(world.energy.get(id)!.value).toBeLessThan(100)
    for (let i = 0; i < 10; i++) stepWorld(world)
    expect(world.motion.get(id)!.velocity.x).toBeCloseTo(0)
    expect(world.motion.get(id)!.velocity.y).toBeCloseTo(0)
  })

  it('charges dash once, respects cooldown and falls back from full thrust when depleted', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const energy = world.energy.get(id)!
    world.input = { reverseControl: true, turn: 0, throttle: 0, dashRequested: true, aim: { x: 1000, y: 25 } }
    stepWorld(world)
    expect(energy.value).toBe(75)
    expect(world.motion.get(id)!.velocity.x).toBeGreaterThan(4)
    world.input.dashRequested = true
    stepWorld(world)
    expect(energy.value).toBe(75)
    expect(world.input.dashRequested).toBe(false)
    for (let i = 0; i < 5; i++) stepWorld(world)
    expect(energy.dashLeft).toBe(0)
    expect(energy.value).toBeGreaterThan(75)
    energy.value = 0; energy.locked = true
    world.input.throttle = 3
    stepWorld(world)
    expect(world.command.get(id)!.power).toBe(0.35)
    expect(energy.value).toBeGreaterThan(0)
    world.input.brake = true
    world.input.dashRequested = true
    stepWorld(world)
    expect(world.command.get(id)!.braking).toBe(false)
    expect(energy.dashLeft).toBe(0)
  })

  it('uses physical thrust for every hull and keeps dash vulnerable to gunfire', () => {
    for (const hull of ['destroyer', 'cruiser', 'battleship'] as const) {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      applyHandling(world, id, hull)
      const body = world.body.get(id)!
      const start = body.x
      const motion = world.motion.get(id)!
      world.projectiles.push({ x: start + 1, y: body.y, vx: 0, vy: 0, radius: .1, life: 3, weapon: 1 })
      world.input = { reverseControl: true, turn: 0, throttle: 0, dashRequested: true, aim: { x: start + 100, y: body.y } }
      stepWorld(world)
      expect(body.x).toBeGreaterThan(start)
      expect(body.x - start).toBeLessThanOrEqual(motion.thrust / motion.mass * 2.5 * SIM_STEP ** 2)
      expect(world.energy.get(id)!.value).toBe(75)
      expect(world.ship.get(id)!.hp).toBeLessThan(100)
    }
  })

  it('tracks a live target while keeping propulsion and firing under player control', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const target = spawnDummy(world, id)
    const body = world.body.get(id)!
    Object.assign(world.body.get(target)!, { x: body.x + 25, y: body.y + 15 })
    world.input = {
      lockTarget: target, reverseControl: true, turn: 0, throttle: 1,
      selectedGun: 1, aim: { x: body.x - 20, y: body.y },
    }
    stepWorld(world)
    expect(body.heading).toBeGreaterThan(0)
    expect(world.command.get(id)!.thrustAngle).toBeCloseTo(Math.PI)
    expect(world.drones.get(id)!.every(gun => gun.target > 0)).toBe(true)
    expect(world.projectiles).toHaveLength(0)
    world.ship.get(target)!.hp = 0
    stepWorld(world)
    expect(world.command.get(id)!.turn).toBe(0)
  })

  it('coasts broadside in neutral and recovers energy', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const body = world.body.get(id)!
    const start = body.y
    const motion = world.motion.get(id)!
    motion.velocity = { x: 0, y: 20 }
    world.energy.get(id)!.value = 30
    for (let i = 0; i < 30; i++) stepWorld(world)
    expect(motion.velocity.y).toBeGreaterThan(8)
    expect(motion.velocity.y).toBeLessThan(20)
    expect(body.y - start).toBeGreaterThan(30)
    expect(world.energy.get(id)!.value).toBeCloseTo(72)
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

describe('speed camera', () => {
  it('widens the view monotonically and clamps both ends', () => {
    expect(cameraScaleForSpeed(0)).toBe(5)
    expect(cameraScaleForSpeed(8)).toBe(5)
    expect(cameraScaleForSpeed(30)).toBeLessThan(5)
    expect(cameraScaleForSpeed(60)).toBeCloseTo(960 / 360)
    expect(cameraScaleForSpeed(200)).toBe(cameraScaleForSpeed(60))
    for (let speed = 1; speed < 100; speed++) expect(cameraScaleForSpeed(speed)).toBeLessThanOrEqual(cameraScaleForSpeed(speed - 1))
  })
  it('smooths zoom consistently across frame rates and preserves pointer projection', () => {
    const run = (hz: number) => {
      let camera = { x: 0, y: 0, scale: 5 }
      for (let i = 0; i < hz; i++) camera = followCamera(camera, { x: 0, y: 0 }, 1 / hz, 60)
      return camera
    }
    const camera = run(60)
    expect(camera.scale).toBeCloseTo(run(30).scale, 8)
    expect(camera.scale).toBeGreaterThan(cameraScaleForSpeed(60))
    const point = { x: 35, y: -20 }
    const screen = worldToScreen(camera, 960, 600, point)
    const restored = screenToWorld(camera, 960, 600, screen.x, screen.y)
    expect(restored.x).toBeCloseTo(point.x); expect(restored.y).toBeCloseTo(point.y)
  })
})

describe('enemy training target', () => {
  it('takes ordinary projectile damage, stays still under player input, and resets', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const player = manualShip(world)!
    const target = spawnDummy(world, player)
    const body = world.body.get(target)!
    const start = { x: body.x, y: body.y }
    world.projectiles.push({ owner: player, x: body.x - 4, y: body.y, vx: 50, vy: 0, radius: .45, life: 2, weapon: 1 })
    world.input.turn = 1; world.input.throttle = 3
    stepWorld(world)
    expect(world.ship.get(target)!.hp).toBeLessThan(100)
    expect(body.x).toBe(start.x); expect(body.y).toBe(start.y)
    expect(world.command.has(target)).toBe(false)
    resetDummy(world, target)
    expect(world.ship.get(target)!.hp).toBe(100)
    expect(world.projectiles).toHaveLength(0)
  })
})
