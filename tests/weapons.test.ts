import { describe, expect, it } from 'vitest'
import { weapons } from '../experiments/fleet-collection/config'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
describe('weapon models', () => {
  it('matches each gun turret and barrel layout', () => {
    for (const [id, mounts, barrels] of [['destroyerGun',2,1],['cruiserGun',3,1],['battleshipTwin',2,2],['battleshipTriple',2,3]] as const) {
      const w=weapons[id];expect([w.mounts,w.barrelsPerMount,w.spread.length]).toEqual([mounts,barrels,mounts*barrels])
    }
    expect(weapons.battleshipTriple.cooldown).not.toBe(weapons.battleshipTwin.cooldown)
    expect(weapons.battleshipTriple.spread).not.toEqual(weapons.battleshipTwin.spread)
  })
  it('fires destroyer guns and torpedoes on independent cooldowns', () => {
    let b=createDogfight(42,[0],[0],17,true);b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?20:40,y:50,speed:0}));b.intel={blue:{'red-0':100},red:{'blue-0':100}};b=stepDogfight(b)
    expect(b.shots).toBe(12);expect(b.projectiles.filter(p=>p.damage==='kinetic')).toHaveLength(4);expect(b.projectiles.filter(p=>p.damage==='underwater')).toHaveLength(8)
    expect(b.ships[0].weaponSlots[0].readyAt).toBe(weapons.destroyerGun.cooldown);expect(b.ships[0].weaponSlots[1].readyAt).toBe(weapons.torpedo.cooldown)
    expect(weapons.torpedo.projectileSpeed).toBeLessThan(weapons.destroyerGun.projectileSpeed)
    for(let i=0;i<31;i++)b=stepDogfight(b)
    expect(b.shots).toBeGreaterThan(12);expect(b.ships[0].weaponSlots[1].readyAt).toBe(weapons.torpedo.cooldown)
  })
})

it('resolves three weapon slots independently without changing another unit', () => {
  let b=createDogfight(42,[1],[1],17,true)
  b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?20:40,y:50,speed:0,weaponSlots:s.team==='blue'?[...s.weaponSlots,{...s.weaponSlots[0],slotId:'extra-a',readyAt:0},{...s.weaponSlots[0],slotId:'extra-b',readyAt:0}]:s.weaponSlots}))
  b.intel={blue:{'red-0':100},red:{'blue-0':100}};b=stepDogfight(b)
  expect(b.shots).toBe(12)
  expect(b.ships[0].weaponSlots.map(s=>s.readyAt)).toEqual([4,4,4])
  expect(b.ships[1].weaponSlots).toHaveLength(1)
})
