import { expect, it } from 'vitest'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
import { findPath } from '../experiments/fleet-collection/dogfight/pathfinding'
import { terrainImpact, type TerrainBox } from '../experiments/fleet-collection/dogfight/terrain'

const gap = (point: { x: number; y: number }, box: TerrainBox) => {
  const x = Math.max(box.x, Math.min(point.x, box.x + box.width))
  const y = Math.max(box.y, Math.min(point.y, box.y + box.height))
  return Math.hypot(point.x - x, point.y - y)
}

it('arcs around a tower early and does not reverse the bypass', () => {
  const wall: TerrainBox = { id: 'wall', x: 20, y: -12, width: 16, height: 24, kind: 'tower', blocks: ['surface', 'submerged'] }
  let b = createDogfight(3, [0], [0], 17, true)
  b.terrain = [wall]
  b.ships = b.ships.map(s => s.team === 'blue' ? { ...s, x: -10, y: 0 } : { ...s, x: 70, y: 0 })
  b.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
  b.headings = { 'blue-0': 0 }
  const headings: number[] = []
  let turnedWhileClear = false
  let minGapSeen = Infinity
  for (let i = 0; i < 40 && !b.result; i++) {
    b = stepDogfight(b)
    const ship = b.ships.find(s => s.id === 'blue-0')!
    const heading = Math.atan2(Math.sin(b.headings['blue-0']), Math.cos(b.headings['blue-0']))
    headings.push(heading)
    const clearance = gap(ship, wall)
    minGapSeen = Math.min(minGapSeen, clearance)
    if (clearance > 12 && Math.abs(heading) > 0.35) turnedWhileClear = true
  }
  let flips = 0
  let previous = 0
  for (const heading of headings) {
    const sign = Math.abs(heading) < 0.2 ? 0 : Math.sign(heading)
    if (sign !== 0 && previous !== 0 && sign !== previous) flips++
    if (sign !== 0) previous = sign
  }
  expect(turnedWhileClear).toBe(true)
  expect(minGapSeen).toBeGreaterThan(3.5)
  expect(flips).toBe(0)
})

it('pushes a destroyer out of a tower after it has been stuck', () => {
  const tower: TerrainBox = { id: 'tower', x: 0, y: 0, width: 50, height: 50, kind: 'tower', blocks: ['surface', 'submerged'] }
  let b = createDogfight(1, [0], [0], 17, true)
  b.terrain = [tower]
  b.ships = b.ships.map(s => s.team === 'blue' ? { ...s, x: 25, y: 25 } : { ...s, x: 200, y: 25 })
  b.headings = { 'blue-0': 0 }
  for (let i = 0; i < 20; i++) b = stepDogfight(b)
  const held = b.ships.find(s => s.id === 'blue-0')!
  expect(Math.hypot(held.x - 25, held.y - 25)).toBeLessThan(1)
  expect(b.events.some(e => e.includes('脱离楼体'))).toBe(false)
  b = stepDogfight(b)
  const freed = b.ships.find(s => s.id === 'blue-0')!
  expect(freed.x < 0 || freed.x > 50 || freed.y < 0 || freed.y > 50).toBe(true)
  expect(gap(freed, tower)).toBeGreaterThan(2)
  expect(b.events.some(e => e.includes('脱离楼体'))).toBe(true)
})

it('routes out of a tower cell before searching onward', () => {
  const boxes: TerrainBox[] = [{ id: 'wall', x: 0, y: 0, width: 20, height: 20, blocks: ['surface'] }]
  const path = findPath({ x: 10, y: 10 }, { x: 40, y: 10 }, 'surface', boxes)
  expect(path?.[0]).toBeTruthy()
  expect(terrainImpact(path![0], path![0], 'surface', boxes, 4)).toBeNull()
})

it('does not leave a destroyer pressed against a city tower', () => {
  for (const seed of [1, 7, 17, 42]) {
    let b = createDogfight(seed, [0], [0], seed)
    const trail: { x: number; y: number }[] = []
    for (let i = 0; i < 250 && !b.result; i++) {
      b = stepDogfight(b)
      const ship = b.ships.find(s => s.id === 'blue-0' && s.hp > 0)
      if (!ship) break
      trail.push({ x: ship.x, y: ship.y })
      if (trail.length < 30) continue
      const window = trail.slice(-30)
      const moved = Math.hypot(window[29].x - window[0].x, window[29].y - window[0].y)
      const near = b.terrain.some(box => box.blocks.includes('surface') && gap(ship, box) <= 3)
      if (near) expect(moved, `seed ${seed} at ${b.time}`).toBeGreaterThan(0.5)
    }
  }
})
