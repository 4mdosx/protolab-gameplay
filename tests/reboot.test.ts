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

  it('accelerates along the keys while the hull is still turning toward the pointer', () => {
    const world = createWorld(17)
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { x: 0, y: -1, aim: { x: body.x + 40, y: body.y } }
    stepWorld(world)
    const motion = world.motion.get(id)!
    expect(motion.velocity.y).toBeLessThan(-1)
    expect(Math.abs(body.heading)).toBeLessThan(0.05)
    expect(body.y).toBeLessThan(25)
  })

  it('parks the gun on the arc edge when the pointer is in the dead zone', () => {
    const world = createWorld(17)
    const id = manualShip(world)!
    const body = world.body.get(id)!
    world.input = { x: 0, y: 0, aim: { x: body.x - 30, y: body.y + 1 } }
    for (let i = 0; i < 20; i++) stepWorld(world)
    const gun = world.gun.get(id)!
    expect(gun.dead).toBe(true)
    expect(Math.abs(Math.abs(gun.local) - gun.arc)).toBeLessThan(0.05)
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
    world.input = { x: 1, y: 0, aim: null }
    for (let i = 0; i < 30; i++) stepWorld(world)
    expect(body.x).toBeLessThan(tower!.x - 1.5)
  })
})
