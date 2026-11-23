import { describe, expect, it } from 'vitest'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
import { moveHull } from '../experiments/fleet-collection/dogfight/motion/move-system'
import { setMovementCommand, steerDestroyer, type MovementCommand } from '../experiments/fleet-collection/dogfight/ai/steering'
import { resolveCharacter } from '../experiments/fleet-collection/config'

describe('destroyer pilot', () => {
  it('tracks velocity toward the command while the hull turns separately', () => {
    const store: Record<string, MovementCommand> = {}
    setMovementCommand(store, 'blue-0', { desiredVelocity: { x: 0, y: 15 }, desiredFacing: 0, maneuver: 'orbit_left' })
    const command = store['blue-0']
    const step = moveHull({
      x: 0, y: 0, heading: 0, velocity: { x: 15, y: 0 },
      desiredVelocity: command.desiredVelocity, desiredFacing: command.desiredFacing,
      thrustAccel: 18, maxSpeed: 15, acceleration: 1.2, turnRate: 0, maxTurnRate: 0.8,
    }, { obstacles: [], time: 0 })
    expect(step.velocity.y).toBeGreaterThan(1)
    expect(step.velocity.x).toBeGreaterThan(10)
    expect(Math.abs(step.heading)).toBeLessThan(0.05)
    expect(step.y).toBeGreaterThan(0)
  })
  it('gives the aggressive destroyer an orbit and the cautious one a hold', () => {
    const raid = resolveCharacter(0).ai
    const screen = resolveCharacter(6).ai
    const shared = { cruise: 15, tactic: 'attack' as const, preferred: 22, distance: 18, ux: 1, uy: 0, travelHeading: 0, blocked: false, inRange: true, buildingOrbit: false, side: 1, held: false }
    expect(steerDestroyer({ ...shared, aggression: raid.aggressiveness }).maneuver).toBe('orbit_left')
    expect(steerDestroyer({ ...shared, aggression: screen.aggressiveness }).maneuver).toBe('hold')
  })
  it('keeps an orbit until the commitment expires', () => {
    let battle = createDogfight(3, [0], [0], 17, true)
    battle.ships = battle.ships.map(s => s.id === 'blue-0' ? { ...s, x: 0, y: 0 } : { ...s, x: 0, y: 20 })
    battle.headings = { 'blue-0': 0, 'red-0': 0 }
    battle.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
    battle = stepDogfight(battle)
    const first = battle.maneuvers['blue-0']
    expect(first === 'orbit_left' || first === 'orbit_right' || first === 'hold').toBe(true)
    battle = stepDogfight(battle)
    expect(battle.maneuvers['blue-0']).toBe(first)
  })
  it('withholds the main guns until the target is inside the forward arc', () => {
    let battle = createDogfight(9, [0], [0], 17, true)
    battle.ships = battle.ships.map(s => s.team === 'blue' ? { ...s, x: 0, y: 0, speed: 0 } : { ...s, x: 0, y: 20, speed: 0 })
    battle.headings = { 'blue-0': 0, 'red-0': Math.PI }
    battle.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
    battle = stepDogfight(battle)
    const kinetic = battle.projectiles.filter(p => p.team === 'blue' && p.damage === 'kinetic')
    const torpedoes = battle.projectiles.filter(p => p.team === 'blue' && p.damage === 'underwater')
    expect(kinetic).toHaveLength(0)
    expect(torpedoes.length).toBeGreaterThan(0)
    expect(Math.abs(battle.headings['blue-0'])).toBeLessThan(0.2)
  })
  it('kicks velocity opposite a salvo and leaves the hull heading behind', () => {
    let battle = createDogfight(9, [0], [0], 17, true)
    battle.ships = battle.ships.map(s => s.team === 'blue' ? { ...s, x: 0, y: 0, speed: 0 } : { ...s, x: 24, y: 0, speed: 0 })
    battle.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
    battle = stepDogfight(battle)
    expect(battle.velocities['blue-0'].x).toBeLessThan(-1)
    expect(Math.abs(battle.headings['blue-0'])).toBeLessThan(0.2)
  })
})
