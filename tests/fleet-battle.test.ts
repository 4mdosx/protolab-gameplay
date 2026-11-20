import { describe, expect, it } from 'vitest'
import { createBattle, stepBattle } from '../experiments/fleet-collection/battle/model'
function finish(seed: number) { let battle = createBattle(seed); while (!battle.result) battle = stepBattle(battle); return battle }
describe('single battle', () => {
  it('replays the same seed with the same events and result', () => { const a = finish(42), b = finish(42); expect(a.ships).toEqual(b.ships); expect(a.events).toEqual(b.events); expect(a.result).toEqual(b.result) })
  it('uses the selected lineup without changing the opposing fleet', () => { const b = createBattle(42, [0, 0, 2]); expect(b.ships.filter(s => s.team === 'blue').map(s => s.name)).toEqual(['侦察驱逐', '侦察驱逐', '炮击战列']); expect(b.ships.filter(s => s.team === 'red').map(s => s.name)).toEqual(['侦察驱逐', '护卫巡洋', '炮击战列']); expect(() => createBattle(42, [5, 0, 1])).toThrow() })
  it('supports 1–6 ships on both sides and validates fleet size', () => { const b = createBattle(2, [0,1,2,0,1,2], [2]); expect(b.ships.filter(s=>s.team==='blue')).toHaveLength(6); expect(b.ships.filter(s=>s.team==='red')).toHaveLength(1); expect(new Set(b.ships.map(s=>s.id)).size).toBe(7); expect(() => createBattle(2, [], [0])).toThrow(); expect(() => createBattle(2, [0], [0,0,0,0,0,0,0])).toThrow() })
  it('keeps both teams in bounds and ends in bounded time', () => { const b = finish(7); expect(b.time).toBeLessThanOrEqual(180); expect(b.ships.every(s => s.x >= 0 && s.x <= 120 && s.y >= 0 && s.y <= 100 && s.hp >= 0)).toBe(true); expect(b.events.some(e => e.includes('发现'))).toBe(true) })
})
