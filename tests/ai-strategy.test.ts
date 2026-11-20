import { describe, expect, it } from 'vitest'
import { characters, resolveCharacter, resolveStrategy, selectState, strategies } from '../experiments/fleet-collection/config'
import type { ShipClass } from '../experiments/fleet-collection/config'

describe('strategy state trees', () => {
  it('gives every ship class more than one strategy', () => {
    for (const shipClass of ['destroyer', 'cruiser', 'battleship', 'carrier', 'submarine'] as ShipClass[]) {
      expect(Object.values(strategies).filter(strategy => strategy.shipClass === shipClass).length).toBeGreaterThan(1)
    }
  })
  it('mounts a different strategy on each character of a class', () => {
    for (const shipClass of ['destroyer', 'cruiser', 'battleship', 'carrier', 'submarine'] as ShipClass[]) {
      const mounted = characters.filter(character => character.shipClass === shipClass).map(character => character.strategy.strategyId)
      expect(new Set(mounted).size).toBe(mounted.length)
    }
  })
  it('derives a closer, less patient variant from higher aggressiveness', () => {
    const cautious = resolveStrategy({ strategyId: 'destroyer-screen', aggressiveness: .1, initiative: .5 }, 'destroyer')
    const eager = resolveStrategy({ strategyId: 'destroyer-screen', aggressiveness: .9, initiative: .5 }, 'destroyer')
    expect(eager.preferredRange).toBeLessThan(cautious.preferredRange)
    expect(eager.useCover).toBe(false)
    expect(cautious.useCover).toBe(true)
    expect(eager.states.map(state => state.id)).toEqual(cautious.states.map(state => state.id))
  })
  it('lets initiative open the attack band farther out without changing the tree', () => {
    const patient = resolveStrategy({ strategyId: 'destroyer-screen', aggressiveness: .4, initiative: .1 }, 'destroyer')
    const active = resolveStrategy({ strategyId: 'destroyer-screen', aggressiveness: .4, initiative: .9 }, 'destroyer')
    const distance = patient.preferredRange * patient.engageRatio + 1
    const situation = { hasTarget: true, distance, weaponReady: true, blocked: false, incoming: false }
    expect(selectState(patient, situation)).toBe('approach')
    expect(selectState(active, situation)).toBe('attack')
  })
  it('walks branches in declaration order', () => {
    const ai = resolveCharacter(0).ai
    expect(selectState(ai, { hasTarget: false, distance: 0, weaponReady: true, blocked: false, incoming: false })).toBe('search')
    expect(selectState(ai, { hasTarget: true, distance: 4, weaponReady: true, blocked: false, incoming: false })).toBe('evade')
    expect(selectState(ai, { hasTarget: true, distance: 40, weaponReady: false, blocked: false, incoming: false })).toBe('cover')
    expect(selectState(ai, { hasTarget: true, distance: 40, weaponReady: true, blocked: true, incoming: false })).toBe('attack')
  })
  it('rejects a strategy mounted on the wrong class', () => {
    expect(() => resolveStrategy({ strategyId: 'carrier-standoff', aggressiveness: .5, initiative: .5 }, 'destroyer')).toThrow(/does not fit/)
  })
})
