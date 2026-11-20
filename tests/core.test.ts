import { describe, expect, it } from 'vitest'
import { evaluateCurve } from '../packages/math'
import { createRandom, run, batch, summarize } from '../packages/simulation'
import { idle, type Config } from '../experiments/idle-loop/model'
const config: Config = {
  cost: { type: 'exponential', base: 10, rate: 1.35 },
  income: { type: 'linear', base: 1, slope: 0.75 },
  bonusChance: 0.1,
}
describe('curves', () => {
  it('evaluates growth and interpolates or clamps points', () => {
    expect(evaluateCurve(config.cost, 2)).toBeCloseTo(18.225)
    const c = {
      type: 'piecewise' as const,
      points: [
        [0, 2],
        [10, 12],
      ] as Array<[number, number]>,
    }
    expect(evaluateCurve(c, 5)).toBe(7)
    expect(evaluateCurve(c, 20)).toBe(12)
  })
  it('rejects malformed points', () =>
    expect(() =>
      evaluateCurve(
        {
          type: 'piecewise',
          points: [
            [0, 1],
            [0, 2],
          ],
        },
        0,
      ),
    ).toThrow())
})
describe('simulation', () => {
  it('replays seeded runs', () => {
    const a = createRandom(42),
      b = createRandom(42)
    expect([a(), a()]).toEqual([b(), b()])
    expect(run(idle, config, 42, 300, 1, () => 'auto')).toEqual(
      run(idle, config, 42, 300, 1, () => 'auto'),
    )
  })
  it('simulates upgrades and summarizes batch results', () => {
    const results = batch(idle, config, [1, 2, 3], 300, 1, () => 'auto')
    expect(results[0].metrics.level).toBeGreaterThan(1)
    expect(summarize([1, 3, 2]).median).toBe(2)
  })
})
