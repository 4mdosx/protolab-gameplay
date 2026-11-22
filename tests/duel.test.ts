import { describe, expect, it } from 'vitest'
import { inArc, ARC_HALF, GUN_RANGE, arcRim } from '../experiments/fleet-collection/duel/arc'
import { moveHull, CRUISE } from '../experiments/fleet-collection/duel/move'
import { createDuel, stepDuel } from '../experiments/fleet-collection/duel/step'

const nose = { x: 0, y: 0, heading: 0 }

describe('1v1 arc', () => {
  it('accepts a target on the nose inside range and rejects the beam and long range', () => {
    expect(inArc(nose, { x: 20, y: 0 })).toBe(true)
    expect(inArc(nose, { x: 10, y: 10 })).toBe(true)
    expect(inArc(nose, { x: 0, y: 20 })).toBe(false)
    expect(inArc(nose, { x: GUN_RANGE + 1, y: 0 })).toBe(false)
  })
  it('draws the rim on the same bearings the fire check uses', () => {
    const rim = arcRim(nose)
    expect(inArc(nose, rim[0])).toBe(true)
    expect(inArc(nose, rim[rim.length - 1])).toBe(true)
    expect(Math.abs(Math.atan2(rim[0].y, rim[0].x) - -ARC_HALF)).toBeLessThan(1e-9)
    expect(Math.hypot(rim[0].x, rim[0].y)).toBeCloseTo(GUN_RANGE)
  })
})

describe('1v1 step', () => {
  it('slides velocity before the hull has finished turning', () => {
    const ship = { id: 'blue', team: 'blue' as const, name: '晴岚', x: 0, y: 0, heading: 0, turnRate: 0, velocity: { x: CRUISE, y: 0 }, hp: 72, cooldown: 0 }
    const step = moveHull(ship, { velocity: { x: 0, y: CRUISE }, facing: 0 }, 0.1)
    expect(step.velocity.y).toBeGreaterThan(1)
    expect(Math.abs(step.heading)).toBeLessThan(0.05)
    expect(step.y).toBeGreaterThan(0)
  })
  it('fires only after the nose cone covers the other ship', () => {
    let duel = createDuel()
    let fired = false
    for (let i = 0; i < 80 && !fired; i++) {
      duel = stepDuel(duel)
      fired = duel.log.some(line => line.includes('开火'))
      if (!fired) {
        for (const ship of duel.hulls) {
          const other = duel.hulls.find(candidate => candidate.id !== ship.id)!
          expect(inArc(ship, other)).toBe(false)
        }
      }
    }
    expect(fired).toBe(true)
    const later = Array.from({ length: 30 }, () => duel).reduce(stepDuel)
    expect(later.hulls.some(ship => ship.hp < 72)).toBe(true)
  })
})
