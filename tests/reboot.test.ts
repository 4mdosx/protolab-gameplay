import { createBindings } from '../experiments/fleet-collection/reboot/bindings'
import { createPilotInput } from '../experiments/fleet-collection/reboot/pilot-input'
import { pointerThrustAngle } from '../experiments/fleet-collection/reboot/systems/control'
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
    world.input = { reverseControl: true, turn: 0, throttle: 2, boostHeld: true, aim: { x: body.x + 40, y: body.y } }
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
    world.input = { reverseControl: false, turn: 0, throttle: 2, boostHeld: true, aim: { x: body.x + 100, y: body.y } }
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
    world.input = { reverseControl: true, turn: 1, throttle: 2, boostHeld: true, aim: { x: body.x + 1000, y: body.y } }
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
    world.input = { selectedGun: 1, reverseControl: false, turn: 0, throttle: 1, aim: { x: body.x - 100, y: body.y - 4.5 } }
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

  it('fires destroyer salvos as three single rounds from each mount in its own direction', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    applyHandling(world, id, 'destroyer')
    const [left, right] = world.drones.get(id)!
    left.local = left.target = -Math.PI / 6
    right.local = right.target = Math.PI / 6
    world.input.fireQueue = [0]

    for (let tick = 0; tick < 6; tick++) {
      gunSystem(world, SIM_STEP)
      const waves = tick >= 5 ? 3 : tick >= 3 ? 2 : 1
      for (const [index, mount] of [left, right].entries()) {
        const shots = world.projectiles.filter(shot => shot.weapon === index + 1)
        expect(shots).toHaveLength(waves)
        for (const shot of shots) expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(mount.local)
      }
    }
  })

  it('fires class barrages with independent reload and larger battleship hitboxes', () => {
    for (const [profile, total, radius] of [['destroyer', 3, .45], ['cruiser', 3, .65], ['battleship', 6, 1]] as const) {
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
        const angles = world.projectiles.slice(0, 2).map(shot => Math.atan2(shot.vy, shot.vx))
        expect(angles[1] - angles[0]).toBeCloseTo(Math.PI / 9)
      }
    }
    const world = createWorld(17)
    world.city.buildings = []
    world.input.fireQueue = [0]
    stepWorld(world)
    expect(world.projectiles.map(shot => shot.weapon)).toEqual([1, 2])
  })

  it('splits cruiser and battleship full salvos across the two barrel directions', () => {
    for (const [profile, primaryPerWave] of [['cruiser', 1], ['battleship', 2]] as const) {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      applyHandling(world, id, profile)
      const [primary, secondary] = world.drones.get(id)!
      primary.local = primary.target = -Math.PI / 6
      secondary.local = secondary.target = Math.PI / 6
      world.input.fireQueue = [0]
      for (let tick = 0; tick < 10; tick++) gunSystem(world, SIM_STEP)
      const primaryShots = world.projectiles.filter(shot => shot.weapon === 1)
      const secondaryShots = world.projectiles.filter(shot => shot.weapon === 2)
      expect(primaryShots).toHaveLength(primaryPerWave * 3)
      expect(secondaryShots).toHaveLength(3)
      expect(primaryShots.every(shot => shot.vy < 0)).toBe(true)
      for (const shot of secondaryShots) expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(secondary.local)
    }
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
    world.input = { reverseControl: true, turn: 1, throttle: 2, boostHeld: true, aim: { x: 1000, y: 25 } }
    stepWorld(world)
    expect(world.body.get(id)!.turnEffort).toBeGreaterThan(0)
    motion.velocity = { x: 30, y: 0 }
    world.input.turn = 0
    world.input.throttle = 1
    world.input.boostHeld = false
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
      world.input = { reverseControl: true, turn: 1, throttle: 2, boostHeld: true, aim: { x: 1000, y: 25 } }
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
    world.input.throttle = 2
    stepWorld(world)
    expect(world.energy.get(id)!.value).toBeLessThan(100)
    for (let i = 0; i < 10; i++) stepWorld(world)
    expect(world.motion.get(id)!.velocity.x).toBeCloseTo(0)
    expect(world.motion.get(id)!.velocity.y).toBeCloseTo(0)
  })

  it('uses the full-thrust drain on every held tick and restores the selected gear on release', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const energy = world.energy.get(id)!
    world.input = { reverseControl: true, turn: 0, throttle: 1, boostHeld: true, aim: { x: 1000, y: 25 } }
    for (let i = 0; i < 5; i++) stepWorld(world)
    expect(energy.value).toBeCloseTo(100 - 18 * 0.5)
    expect(world.command.get(id)!.power).toBe(1)
    const speed = world.motion.get(id)!.velocity.x
    world.input.boostHeld = false
    stepWorld(world)
    expect(world.command.get(id)!.power).toBe(0.1)
    expect(world.motion.get(id)!.velocity.x).toBeGreaterThan(speed * 0.9)
    expect(energy.value).toBeGreaterThan(91)
  })

  it('requires a fresh boost press after depletion', () => {
    const world = createWorld(17)
    world.city.buildings = []
    const id = manualShip(world)!
    const energy = world.energy.get(id)!
    energy.value = 1
    world.input = { reverseControl: true, turn: 0, throttle: 2, boostHeld: true, aim: { x: 1000, y: 25 } }
    stepWorld(world)
    expect(energy.value).toBe(0)
    for (let i = 0; i < 25; i++) stepWorld(world)
    expect(energy.locked).toBe(false)
    expect(world.command.get(id)!.power).toBe(0.35)
    world.input.boostPressed = true
    stepWorld(world)
    expect(world.command.get(id)!.power).toBe(1)
  })

  it('uses physical full thrust for every hull and remains vulnerable to gunfire', () => {
    for (const hull of ['destroyer', 'cruiser', 'battleship'] as const) {
      const world = createWorld(17)
      world.city.buildings = []
      const id = manualShip(world)!
      applyHandling(world, id, hull)
      const body = world.body.get(id)!
      const start = body.x
      const motion = world.motion.get(id)!
      world.projectiles.push({ x: start + 1, y: body.y, vx: 0, vy: 0, radius: .1, life: 3, weapon: 1 })
      world.input = { reverseControl: true, turn: 0, throttle: 1, boostHeld: true, aim: { x: start + 100, y: body.y } }
      stepWorld(world)
      expect(body.x).toBeGreaterThan(start)
      expect(body.x - start).toBeLessThanOrEqual(motion.thrust / motion.mass * SIM_STEP ** 2)
      expect(world.energy.get(id)!.value).toBeCloseTo(98.2)
      expect(world.ship.get(id)!.hp).toBeLessThan(100)
    }
  })

  it('tracks the preselected target only during BD and keeps firing under player control', () => {
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
    expect(body.heading).toBe(0)
    expect(world.drones.get(id)![1].target).toBe(0)
    world.input.boostHeld = true
    stepWorld(world)
    expect(body.heading).toBeGreaterThan(0)
    expect(Math.abs(world.command.get(id)!.thrustAngle)).toBeCloseTo(Math.PI)
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
    world.input = { reverseControl: true, turn: 0, throttle: 2, boostHeld: true, aim: { x: body.x + 100, y: body.y } }
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
    world.input.turn = 1; world.input.throttle = 2
    stepWorld(world)
    expect(world.ship.get(target)!.hp).toBeLessThan(100)
    expect(body.x).toBe(start.x); expect(body.y).toBe(start.y)
    expect(world.command.has(target)).toBe(false)
    resetDummy(world, target)
    expect(world.ship.get(target)!.hp).toBe(100)
    expect(world.projectiles).toHaveLength(0)
  })
})


describe('assisted maneuvers', () => {
  function scenario() {
    const world = createWorld(17)
    world.city.buildings = []
    const player = manualShip(world)!
    const dummy = spawnDummy(world, player)
    return { world, player, dummy, body: world.body.get(player)!, energy: world.energy.get(player)! }
  }

  it('fires repeatedly while enabled and stops launching when switched off', () => {
    const { world, player, dummy } = scenario()
    const turret = world.trainingDummies.get(dummy)!
    stepWorld(world)
    expect(world.projectiles).toHaveLength(0)
    turret.firing = true
    stepWorld(world)
    expect(world.projectiles[0].owner).toBe(dummy)
    for (let i = 0; i < 31; i++) stepWorld(world)
    expect(world.ship.get(player)!.hp).toBe(80)
    turret.firing = false
    for (let i = 0; i < 30; i++) stepWorld(world)
    expect(world.ship.get(player)!.hp).toBe(80)
    expect(world.projectiles).toHaveLength(0)
  })

  it('steers a fast locked turn along an arc without discarding momentum', () => {
    const { world, player, dummy, body } = scenario()
    const motion = world.motion.get(player)!
    motion.velocity = { x: 25, y: 0 }
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    world.input.aim = { x: body.x - 10, y: body.y + 40 }
    stepWorld(world)
    expect(world.command.get(player)!.bd).toBe(true)
    expect(motion.velocity.x).toBeGreaterThan(20)
    expect(motion.velocity.y).toBeGreaterThan(0)
    for (let i = 0; i < 8; i++) stepWorld(world)
    expect(motion.velocity.y).toBeGreaterThan(8)
    expect(Math.hypot(motion.velocity.x, motion.velocity.y)).toBeGreaterThan(24)
  })

  it('uses the last manual thrust direction in weapon mode and restores it after BD', () => {
    const { world, player, dummy, body } = scenario()
    world.input.aim = { x: body.x + 30, y: body.y }
    stepWorld(world)
    world.input.aim = { x: body.x, y: body.y + 40 }
    world.input.selectedGun = 1
    world.input.boostHeld = true
    stepWorld(world)
    expect(world.command.get(player)!.thrustAngle).toBe(0)
    world.input.lockTarget = dummy
    stepWorld(world)
    expect(world.command.get(player)!.thrustAngle).toBeGreaterThan(1)
    world.input.boostHeld = false
    stepWorld(world)
    expect(world.command.get(player)!.thrustAngle).toBe(0)
    expect(world.command.get(player)!.bd).toBeFalsy()
  })

  it('brakes and starts a one-shot recenter, preserving preselection while interrupting boost', () => {
    const { world, player, dummy, body } = scenario()
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    world.input.aim = { x: body.x, y: body.y + 40 }
    world.motion.get(player)!.velocity = { x: 10, y: 0 }
    world.input.brake = true
    stepWorld(world)
    expect(world.pilot.get(player)!.recenterAngle).toBeUndefined()
    body.heading = Math.PI / 2
    body.turnRate = 0.5
    world.input.recenterHeading = body.heading
    stepWorld(world)
    expect(world.command.get(player)!.brakeFraction).toBe(1)
    expect(world.command.get(player)!.bd).toBeFalsy()
    expect(world.motion.get(player)!.velocity.x).toBeLessThan(10)
    world.input.brake = false
    world.input.aim = { x: body.x + 30, y: body.y }
    stepWorld(world)
    expect(world.command.get(player)!.brakeFraction).toBeUndefined()
    expect(world.command.get(player)!.fullThrust).toBeFalsy()
    expect(world.pilot.get(player)!.recenterAngle).toBeCloseTo(Math.PI / 2)
    expect(world.input.lockTarget).toBe(dummy)
    world.input.turn = -1
    stepWorld(world)
    expect(world.pilot.get(player)!.recenterAngle).toBeCloseTo(Math.PI / 2)
    expect(world.command.get(player)!.recentering).toBe(true)
    for (let i = 0; i < 60 && world.pilot.get(player)!.recenterAngle !== undefined; i++) stepWorld(world)
    expect(world.pilot.get(player)!.recenterAngle).toBeUndefined()
    expect(world.command.get(player)!.recentering).toBe(false)
    expect(body.heading).toBeCloseTo(Math.PI / 2, 1)
  })

  it('uses the R keydown snapshot in weapon mode and replaces it on the next tap', () => {
    const { world, player, body } = scenario()
    world.input.selectedGun = 1
    world.input.aim = { x: body.x + 30, y: body.y }
    body.heading = Math.PI / 2
    body.turnRate = 0.5
    world.input.recenterHeading = body.heading
    stepWorld(world)
    expect(world.pilot.get(player)!.recenterAngle).toBeCloseTo(Math.PI / 2)
    expect(world.command.get(player)!.thrustAngle).toBe(0)
    expect(world.command.get(player)!.brakeFraction).toBeUndefined()
    expect(world.command.get(player)!.power).toBe(0.1)
    const replacement = body.heading
    world.input.recenterHeading = replacement
    stepWorld(world)
    expect(world.pilot.get(player)!.recenterAngle).toBeCloseTo(replacement)
  })

  it('turns a stationary hull toward the mouse angle captured on keydown', () => {
    const { world, player, body } = scenario()
    const aim = { x: body.x, y: body.y + 30 }
    expect(pointerThrustAngle(body, aim, false)).toBeCloseTo(3 * Math.PI / 2)
    world.input.recenterHeading = pointerThrustAngle(body, aim, true)
    world.input.aim = { x: body.x + 30, y: body.y }
    stepWorld(world)
    expect(world.command.get(player)!.recentering).toBe(true)
    expect(body.heading).toBeGreaterThan(0)
    for (let i = 0; i < 60; i++) stepWorld(world)
    expect(body.heading).toBeCloseTo(Math.PI / 2, 1)
    expect(world.pilot.get(player)!.recenterAngle).toBeUndefined()
  })

  it('holds the clicked course through locked BD without disturbing tracking or speed', () => {
    const { world, player, dummy, body, energy } = scenario()
    const motion = world.motion.get(player)!
    motion.velocity = { x: 25, y: 0 }
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    world.input.aim = { x: body.x + 40, y: body.y }
    stepWorld(world)
    world.input.recenterHeading = Math.PI / 2
    world.input.aim = { x: body.x - 40, y: body.y }
    stepWorld(world)
    expect(world.command.get(player)?.bd).toBe(true)
    expect(world.command.get(player)?.thrustAngle).toBeCloseTo(Math.PI / 2)
    expect(world.pilot.get(player)?.recenterAngle).toBeUndefined()
    expect(world.drones.get(player)!.every(gun => gun.manualTarget !== undefined)).toBe(true)
    expect(energy.value).toBeCloseTo(96.4)
    for (let i = 0; i < 6; i++) stepWorld(world)
    expect(world.command.get(player)?.thrustAngle).toBeCloseTo(Math.PI / 2)
    expect(motion.velocity.y).toBeGreaterThan(0)
    expect(Math.hypot(motion.velocity.x, motion.velocity.y)).toBeGreaterThan(24)

    world.input.recenterHeading = 0
    stepWorld(world)
    expect(world.command.get(player)?.thrustAngle).toBe(0)
    expect(world.command.get(player)?.bd).toBe(true)

    world.input.stepDirection = 'right'
    stepWorld(world)
    expect(world.command.get(player)?.step).toBeDefined()
    expect(world.pilot.get(player)?.bdCourse).toBeUndefined()
  })

  it('steers locked BD around an obstacle unless the player supplies a course snapshot', () => {
    const { world, player, dummy, body } = scenario()
    world.motion.get(player)!.velocity = { x: 22, y: 0 }
    world.city.buildings = [{
      id: 'bd-tower', x: body.x + 25, y: body.y - 3, width: 4, height: 6,
      blocks: ['surface'], kind: 'tower',
    }]
    world.input.aim = { x: body.x + 80, y: body.y }
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    stepWorld(world)
    expect(world.command.get(player)?.avoidingObstacle).toBe(true)
    expect(Math.abs(world.command.get(player)!.thrustAngle)).toBeGreaterThan(0)
    world.input.recenterHeading = 0
    stepWorld(world)
    expect(world.command.get(player)?.bd).toBe(true)
    expect(world.command.get(player)?.avoidingObstacle).toBeUndefined()
    expect(world.command.get(player)?.thrustAngle).toBe(0)
    world.input.boostHeld = false
    stepWorld(world)
    world.input.boostHeld = true
    world.input.boostPressed = true
    const farEdge = world.city.buildings[0].x + world.city.buildings[0].width
    for (let i = 0; i < 16; i++) stepWorld(world)
    expect(body.x).toBeGreaterThan(farEdge)
    expect(world.motion.get(player)!.velocity.x).toBeGreaterThan(10)
  })

  it('brakes a locked BD before a wide wall when steering alone cannot clear it', () => {
    const { world, player, dummy, body, energy } = scenario()
    const motion = world.motion.get(player)!
    motion.velocity = { x: 18, y: 0 }
    const wallX = body.x + 11
    world.city.buildings = [{
      id: 'bd-wide-wall', x: wallX, y: body.y - 50, width: 10, height: 100,
      blocks: ['surface'], kind: 'tower',
    }]
    world.input.aim = { x: body.x + 80, y: body.y }
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    stepWorld(world)
    expect(world.command.get(player)?.bd).toBe(true)
    expect(world.command.get(player)?.brakeFraction).toBeGreaterThan(0)
    expect(motion.velocity.x).toBeLessThan(18)
    expect(energy.value).toBeCloseTo(97.6)
    for (let i = 0; i < 7; i++) stepWorld(world)
    expect(body.x).toBeLessThan(wallX - 2.5)
  })

  it('clears a recenter snapshot on locked boost', () => {
    const { world, player, dummy, body } = scenario()
    world.input.lockTarget = dummy
    body.turnRate = 0.5
    world.input.recenterHeading = body.heading
    stepWorld(world)
    expect(world.command.get(player)!.recentering).toBe(true)
    world.input.boostHeld = true
    world.input.boostPressed = true
    stepWorld(world)
    expect(world.command.get(player)!.bd).toBe(true)
    expect(world.command.get(player)!.recentering).toBe(false)
    expect(world.pilot.get(player)!.recenterAngle).toBeUndefined()
  })

  it('preserves the hull snapshot during Step, including when Step is unaffordable', () => {
    for (const energyBeforeStep of [100, 1]) {
      const { world, player, body, energy } = scenario()
      body.heading = 0.6
      body.turnRate = 0.5
      world.input.recenterHeading = body.heading
      stepWorld(world)
      energy.value = energyBeforeStep
      world.input.stepDirection = 'down'
      stepWorld(world)
      const command = world.command.get(player)!
      expect(!!command.step).toBe(energyBeforeStep === 100)
      expect(command.recentering).toBe(true)
      expect(world.pilot.get(player)!.recenterAngle).toBe(0.6)
    }
  })

  it('preserves the hull snapshot through unlocked full thrust', () => {
    const { world, player, body } = scenario()
    body.heading = 0.6
    body.turnRate = 0.5
    world.input.recenterHeading = body.heading
    world.input.aim = { x: body.x + 80, y: body.y }
    stepWorld(world)
    world.input.boostHeld = true
    world.input.boostPressed = true
    stepWorld(world)
    expect(world.command.get(player)!.fullThrust).toBe(true)
    expect(world.command.get(player)!.recentering).toBe(true)
    expect(world.pilot.get(player)!.recenterAngle).toBe(0.6)
  })

  it('spends Step energy only for a course change and physically avoids an incoming round', () => {
    function run(step: boolean) {
      const { world, player, dummy, body, energy } = scenario()
      world.motion.get(player)!.velocity = { x: 6, y: 0 }
      world.projectiles.push({ owner: dummy, x: body.x + 18, y: body.y, vx: -34, vy: 0, radius: .45, life: 3, weapon: 1 })
      world.input.stepDirection = step ? 'down' : undefined
      stepWorld(world)
      expect(energy.value).toBe(step ? 68 : 100)
      if (step) expect(energy.step).toBeDefined()
      for (let i = 0; i < 8; i++) stepWorld(world)
      return world.ship.get(player)!.hp
    }
    expect(run(false)).toBe(90)
    expect(run(true)).toBe(100)
  })

  it('preserves BD on an unaffordable Step and requires a new boost press after a paid Step', () => {
    const { world, player, dummy, body, energy } = scenario()
    world.input.lockTarget = dummy
    world.input.boostHeld = true
    world.input.aim = { x: body.x + 80, y: body.y }
    stepWorld(world)
    energy.value = 20
    world.input.stepDirection = 'down'
    stepWorld(world)
    expect(energy.value).toBeCloseTo(18.2)
    expect(world.command.get(player)!.bd).toBe(true)
    expect(energy.feedback).toContain('能量不足')

    energy.value = 75
    world.input.stepDirection = 'down'
    stepWorld(world)
    expect(energy.step).toBeDefined()
    expect(world.command.get(player)!.bd).toBeFalsy()
    expect(energy.value).toBe(43)
    for (let i = 0; i < 4; i++) stepWorld(world)
    expect(world.command.get(player)!.bd).toBeFalsy()
    world.input.boostPressed = true
    stepWorld(world)
    expect(world.command.get(player)!.bd).toBe(true)
  })

  it('short-pushes toward the selected screen direction regardless of hull heading or aim', () => {
    const { world, player, body, energy } = scenario()
    body.heading = Math.PI / 3
    world.input.aim = { x: body.x + 80, y: body.y }
    world.input.stepDirection = 'down'
    stepWorld(world)
    expect(energy.step?.angle).toBeCloseTo(Math.PI / 2)
    expect(energy.value).toBe(68)
    expect(world.motion.get(player)!.velocity.y).toBeGreaterThan(5)
  })

  it('still chooses a feasible Step when every course risks a hit', () => {
    const { world, dummy, body, energy } = scenario()
    world.projectiles.push({ owner: dummy, x: body.x, y: body.y, vx: 10, vy: 0, radius: .45, life: 3, weapon: 1 })
    world.input.stepDirection = 'down'
    stepWorld(world)
    expect(energy.step).toBeDefined()
    expect(energy.value).toBe(68)
  })

  it('rejects a blocked left Step even when the right side is open', () => {
    const { world, body, energy } = scenario()
    world.city.buildings = [{
      id: 'left-wall', x: body.x - 12.1, y: body.y - 30, width: 10, height: 60,
      blocks: ['surface'], kind: 'tower',
    }]
    world.input.stepDirection = 'left'
    stepWorld(world)
    expect(energy.step).toBeUndefined()
    expect(energy.value).toBe(100)
    world.input.stepDirection = 'right'
    stepWorld(world)
    expect(energy.step?.angle).toBeCloseTo(0)
    expect(energy.value).toBe(68)
  })

  it('reports no maneuvering room and keeps the energy when the hull is trapped', () => {
    const { world, body, energy } = scenario()
    world.city.buildings = [{
      id: 'enclosure', x: body.x - 20, y: body.y - 20, width: 40, height: 40,
      blocks: ['surface'], kind: 'tower',
    }]
    world.input.stepDirection = 'down'
    stepWorld(world)
    expect(energy.step).toBeUndefined()
    expect(energy.value).toBe(100)
    expect(energy.feedback).toContain('无变轨空间')
  })
})


describe('pilot command bindings', () => {
  it('holds boost on Q while Step and Shift gear toggles stay independent', () => {
    const { input } = createWorld(17)
    const pilot = createPilotInput(input)
    const bindings = createBindings(pilot.press, pilot.release)
    bindings.keyDown('KeyQ', false)
    expect(input.boostHeld).toBe(true)
    expect(input.boostPressed).toBe(true)
    input.boostPressed = false
    bindings.keyDown('ShiftLeft', false)
    bindings.keyDown('ShiftRight', false)
    expect(input.throttle).toBe(2)
    expect(bindings.keyDown('KeyA', false)).toBe(true)
    bindings.keyUp('ShiftLeft')
    bindings.keyUp('ShiftRight')
    expect(input.stepDirection).toBe('left')
    expect(input.boostHeld).toBe(true)
    expect(input.boostPressed).toBe(false)
    bindings.keyUp('KeyQ')
    expect(input.boostHeld).toBe(false)
  })

  it('maps left click to recenter and Space to one shot from the selected gun', () => {
    const { input } = createWorld(17)
    const pilot = createPilotInput(input)
    const bindings = createBindings(action => pilot.press(action, { recenterHeading: 1 }), pilot.release)
    bindings.keyDown('Digit2', false)
    expect(bindings.pointerDown(0)).toBe(true)
    expect(input.recenterHeading).toBe(1)
    expect(input.fireQueue).toBeUndefined()
    bindings.keyDown('Space', false)
    bindings.keyDown('Space', true)
    expect(input.fireQueue).toEqual([2])
    expect(input.stepDirection).toBeUndefined()
    expect(bindings.pointerDown(1)).toBe(false)
    bindings.keyDown('ShiftLeft', false)
    bindings.keyDown('ShiftLeft', true)
    expect(input.throttle).toBe(2)
    bindings.keyDown('KeyE', false)
    expect(input.brake).toBe(true)
    expect(input.throttle).toBe(2)
    bindings.keyUp('KeyE')
    expect(input.brake).toBe(false)
    bindings.reset()
    pilot.reset()
    expect(input.fireQueue).toEqual([])
    expect(input.throttle).toBe(2)
  })
})
