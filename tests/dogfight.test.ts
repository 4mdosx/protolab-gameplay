import { describe, expect, it } from 'vitest'
import { createDogfight, stepDogfight, sweptHit } from '../experiments/fleet-collection/dogfight/model'
function finish(seed: number) { let b=createDogfight(seed); while(!b.result)b=stepDogfight(b);return b }
describe('dogfight comparison',()=>{
  it('detects a crossing even when endpoints miss',()=>{expect(sweptHit({x:0,y:0},{x:10,y:0},{x:5,y:-4},{x:5,y:4},1)).toBe(true);expect(sweptHit({x:0,y:0},{x:10,y:0},{x:5,y:5},{x:5,y:5},1)).toBe(false)})
  it('disengages when opposing ships overlap',()=>{let b=createDogfight(42); b.ships=b.ships.filter(s=>s.id==='blue-0'||s.id==='red-0').map(s=>({...s,x:60,y:50}));b.intel={blue:{'red-0':100},red:{'blue-0':100}};for(let i=0;i<10;i++)b=stepDogfight(b);expect(Math.hypot(b.ships[0].x-b.ships[1].x,b.ships[0].y-b.ships[1].y)).toBeGreaterThan(10)})
  it('limits heading changes when movement decisions fluctuate',()=>{let b=createDogfight(42);for(let i=0;i<500&&!b.result;i++){const old=b; b=stepDogfight(b);for(const id of Object.keys(old.headings)){if(b.headings[id]===undefined)continue;const d=b.headings[id]-old.headings[id];expect(Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))).toBeLessThanOrEqual(0.350001)}}})
  it('bounds angular speed and acceleration',()=>{let b=createDogfight(42);for(let i=0;i<500&&!b.result;i++){const old=b;b=stepDogfight(b);for(const [id,rate] of Object.entries(b.turnRates)){expect(Math.abs(rate)).toBeLessThanOrEqual(.800001);expect(Math.abs(rate-(old.turnRates[id]??0))).toBeLessThanOrEqual(.120001)}}})
  it('simulates configured 6v6 fleets reproducibly',()=>{const run=()=>{let b=createDogfight(12,[0,1,2,0,1,2],[2,1,0,2,1,0]);for(let i=0;i<500&&!b.result;i++)b=stepDogfight(b);return b};const a=run(),b=run();expect(a.ships).toHaveLength(12);expect(a.ships).toEqual(b.ships)})
  it('replays a complete battle and produces trajectories',()=>{const a=finish(42),b=finish(42);expect(a.ships).toEqual(b.ships);expect(a.events).toEqual(b.events);expect(a.shots).toBeGreaterThan(0);expect(a.collisions+a.dodges).toBeGreaterThan(0);expect(a.time).toBeLessThanOrEqual(180)})
})

describe('bullet hitboxes', () => {
  it('hits an intervening enemy even after the intended target exits', () => {
    let b = createDogfight(123, [0], [0, 1])
    b.ships = b.ships.map(s => s.team === 'blue' ? { ...s, x: -50, y: 0 } : s.id === 'red-0' ? { ...s, x: 5, y: 0, speed: 0 } : { ...s, hp: 0 })
    b.projectiles = [{ id: 0, team: 'blue', source: 'blue-0', target: 'red-1', x: 0, y: 0, vx: 30, vy: 0, remaining: 30, power: 20, damage: 'kinetic', accuracy: 1, acc: 100, lock: 1 }]
    b.random = () => 0
    b = stepDogfight(b)
    expect(b.collisions).toBe(1)
    expect(b.ships.find(s => s.id === 'red-0')!.hp).toBeLessThan(72)
    expect(b.projectiles).toHaveLength(0)
  })
})

describe('2.5D and terrain', () => {
  it('restricts weapons by target layer', async () => {
    const { canAttack } = await import('../experiments/fleet-collection/dogfight/model')
    const b = createDogfight(1, [1, 0], [3, 4])
    expect(canAttack(b.ships[0], b.ships[2])).toBe(true)
    expect(canAttack(b.ships[0], b.ships[3])).toBe(false)
    expect(canAttack(b.ships[1], b.ships[2])).toBe(false)
    expect(canAttack(b.ships[1], b.ships[3])).toBe(true)
  })
  it('blocks surface movement and allows aircraft above terrain', async () => {
    const { terrainImpact } = await import('../experiments/fleet-collection/dogfight/terrain')
    const box = [{ id: 'test', x: 10, y: 0, width: 10, height: 10, blocks: ['surface', 'submerged'] as ('surface' | 'submerged')[] }]
    expect(terrainImpact({ x: 0, y: 5 }, { x: 30, y: 5 }, 'surface', box)).toBeCloseTo(1/3)
    expect(terrainImpact({ x: 0, y: 5 }, { x: 30, y: 5 }, 'air', box)).toBeNull()
  })
})

it('prevents surface units entering a terrain box across multiple steps', () => {
  let b = createDogfight(7, [0], [0])
  b.terrain = [{ id: 'wall', x: 20, y: 10, width: 10, height: 30, blocks: ['surface', 'submerged'] }]
  b.ships = b.ships.map(s => s.team === 'blue' ? { ...s, x: 17, y: 25 } : { ...s, x: 100, y: 25 })
  b.headings = { 'blue-0': 0 }
  for (let i = 0; i < 10 && !b.result; i++) {
    b = stepDogfight(b)
    const s = b.ships.find(s => s.id === 'blue-0')!
    expect(s.x > 18 && s.x < 32 && s.y > 8 && s.y < 42).toBe(false)
  }
})
