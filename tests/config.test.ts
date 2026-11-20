import { describe, expect, it } from 'vitest'
import { characters, weapons, aiModules, resolveCharacter } from '../experiments/fleet-collection/config'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
describe('character configuration', () => {
  it('resolves all weapon and AI references without sharing mutable state', () => { for(let i=0;i<characters.length;i++){const c=resolveCharacter(i);expect(weapons[c.weaponId]).toBeDefined();expect(aiModules[c.aiId]).toBeDefined();c.stats.hp=1;expect(characters[i].stats.hp).not.toBe(1)} })
  it('uses configured spread and range in combat', () => { let b=createDogfight(42,[1],[1],17,true);b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?20:40,y:50,weapon:{...s.weapon,range:25,spread:[-.1,.1]},speed:0}));b.intel={blue:{'red-0':100},red:{'blue-0':100}};b=stepDogfight(b);expect(b.shots).toBe(4);expect(b.projectiles).toHaveLength(4);expect(new Set(b.projectiles.filter(p=>p.team==='blue').map(p=>p.vy)).size).toBe(2) })
  it('uses AI turn limit', () => {let b=createDogfight(42,[0],[0],17,true);b.ships=b.ships.map(s=>({...s,ai:{...s.ai,turnRate:.1,turnAcceleration:.2}}));b=stepDogfight(b);for(let i=0;i<20;i++)b=stepDogfight(b);expect(Object.values(b.turnRates).every(rate=>Math.abs(rate)<=.100001)).toBe(true)})
})
