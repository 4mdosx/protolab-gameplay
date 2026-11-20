import { describe, expect, it } from 'vitest'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
import { setIntentHeading, type IntentStore } from '../experiments/fleet-collection/dogfight/ai/intent'
import { moveSystem } from '../experiments/fleet-collection/dogfight/motion/move-system'

describe('intent and move system', () => {
  it('publishes intent heading only through the API', () => {
    const store: IntentStore = { headings: {} }
    setIntentHeading(store, 'blue-0', Math.PI * 3)
    expect(store.headings['blue-0']).toBeCloseTo(Math.PI)
    expect(() => setIntentHeading(store, 'blue-0', Number.NaN)).toThrow(/invalid intent heading/)
  })
  it('turns the hull toward the intent heading with acceleration, then moves at speed', () => {
    const store: IntentStore = { headings: {} }
    setIntentHeading(store, 'blue-0', Math.PI / 2)
    const step = moveSystem({
      x: 0, y: 0, heading: 0, intentHeading: store.headings['blue-0'],
      acceleration: 1.2, speed: 15, turnRate: 0, maxTurnRate: 0.8,
    }, { obstacles: [], time: 0 })
    expect(step.turnRate).toBeCloseTo(0.12)
    expect(step.heading).toBeCloseTo(0.012)
    expect(step.heading).toBeLessThan(0.1)
    expect(Math.hypot(step.x, step.y)).toBeCloseTo(1.5)
    expect(step.y).toBeGreaterThan(0)
  })
  it('keeps the published intent heading separate from the hull heading', () => {
    let battle = createDogfight(42, [0], [0], 17, true)
    battle.ships = battle.ships.map(s => s.id === 'blue-0' ? { ...s, x: 0, y: 0 } : { ...s, x: 0, y: 40 })
    battle.headings = { 'blue-0': 0 }
    battle.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
    battle = stepDogfight(battle)
    expect(Number.isFinite(battle.intentHeadings['blue-0'])).toBe(true)
    expect(Math.abs(battle.intentHeadings['blue-0'])).toBeGreaterThan(0.4)
    expect(Math.abs(battle.headings['blue-0'])).toBeLessThan(0.2)
  })
})
