import { describe, it, expect } from 'vitest'
import { createWorld, manualShip, stepWorld } from '../experiments/fleet-collection/reboot/engine/world'

describe('tail nozzle controls', () => {
  it('tracks mouse heading while ordinary and unlocked boost thrust remain forward', () => {
    const world = createWorld(17), id = manualShip(world)!
    world.city.buildings = []
    const body = world.body.get(id)!
    world.input.controlMode = 'tail'
    world.input.aim = { x: body.x, y: body.y + 100 }
    world.input.boostHeld = true; world.input.boostPressed = true
    stepWorld(world)
    expect(world.command.get(id)!.hullThrust).toBe(true)
    expect(body.turnRate).toBeGreaterThan(0)
    expect(body.turnRate).toBeLessThanOrEqual(world.motion.get(id)!.maxTurnRate)
    expect(world.command.get(id)!.appliedThrustAngle).toBeCloseTo(body.heading)
  })
})

it('holds heading for C or selected weapons and resumes mouse tracking on exit', () => {
  const world = createWorld(17), id = manualShip(world)!
  world.city.buildings = []
  const body = world.body.get(id)!
  world.input.controlMode = 'tail'
  world.input.headingHold = true
  world.input.aim = { x: body.x, y: body.y + 100 }
  stepWorld(world)
  expect(world.command.get(id)!.turn).toBe(0)
  world.input.headingHold = false; world.input.selectedGun = 1
  stepWorld(world)
  expect(world.command.get(id)!.turn).toBe(0)
  world.input.selectedGun = 0
  stepWorld(world)
  expect(world.command.get(id)!.turn).toBeGreaterThan(0)
})

it('chains Q into the captured Step direction rather than the moving hull heading', () => {
  const world = createWorld(17), id = manualShip(world)!
  world.city.buildings = []
  const body = world.body.get(id)!
  world.input.controlMode = 'tail'
  world.input.aim = { x: body.x + 100, y: body.y }
  world.input.stepDirection = 'right'
  stepWorld(world)
  const angle = world.pilot.get(id)!.stepLink!.angle
  world.input.boostHeld = true; world.input.boostPressed = true
  for (let i = 0; i < 4; i++) stepWorld(world)
  expect(world.command.get(id)!.fullThrust).toBe(true)
  expect(world.command.get(id)!.hullThrust).toBe(false)
  expect(world.command.get(id)!.thrustAngle).toBe(angle)
  world.input.boostHeld = false
  stepWorld(world)
  expect(world.pilot.get(id)!.boostCourse).toBeUndefined()
})
