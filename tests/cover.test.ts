import { describe, expect, it } from 'vitest'
import { chooseCover } from '../experiments/fleet-collection/dogfight/cover'
import { terrainImpact } from '../experiments/fleet-collection/dogfight/terrain'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
const box = { id:'wall',x:10,y:-5,width:10,height:10,blocks:['surface','submerged'] as ('surface'|'submerged')[] }
describe('cover',()=>{
  it('finds reachable cover occluded from the enemy',()=>{const ship={x:30,y:0},enemy={x:0,y:0},cover=chooseCover(ship,enemy,'surface',[box]);expect(cover).not.toBeNull();expect(terrainImpact(enemy,cover!.goal,'surface',[box])).not.toBeNull();expect(terrainImpact(cover!.goal,cover!.goal,'surface',[box],4)).toBeNull();expect(chooseCover(ship,enemy,'air',[box])).toBeNull()})
  it('stops a projectile at a building before a ship',()=>{let b=createDogfight(7,[0],[0]);b.terrain=[box];b.ships=b.ships.map(s=>s.team==='blue'?{...s,x:0,y:0,speed:0}:{...s,x:25,y:0,speed:0});b.projectiles=[{id:1,team:'blue',source:'blue-0',target:'red-0',x:8,y:0,vx:30,vy:0,remaining:40,power:100,damage:'kinetic',accuracy:1,acc:100,lock:1,layer:'surface'}];b=stepDogfight(b);expect(b.projectiles).toHaveLength(0);expect(b.ships.find(s=>s.team==='red')!.hp).toBe(72);expect(b.events.some(e=>e.includes('地形阻挡'))).toBe(true)})
})

describe('cooldown tactics',()=>{
  it('finds a clear and reachable firing position around cover',async()=>{const {chooseFiringPosition}=await import('../experiments/fleet-collection/dogfight/cover');const enemy={x:0,y:0},ship={x:30,y:0},result=chooseFiringPosition(ship,enemy,'surface',50,[box]);expect(result).not.toBeNull();expect(terrainImpact(result!.goal,enemy,'surface',[box])).toBeNull()})
  it('uses cooldown to seek cover and ready weapons seek attack for both teams',()=>{let b=createDogfight(5,[0],[0]);b.terrain=[box];b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?0:30,y:0,readyAt:s.team==='blue'?10:0,speed:0}));b.intel={blue:{'red-0':100},red:{'blue-0':100}};b=stepDogfight(b);expect(b.tactics['blue-0']).toBe('cover');expect(b.tactics['red-0']).toBe('attack');expect(b.shots).toBe(0);b.ships=b.ships.map(s=>({...s,readyAt:s.team==='red'?10:0}));b=stepDogfight(b);expect(b.tactics['blue-0']).toBe('attack');expect(b.tactics['red-0']).toBe('cover')})
})
