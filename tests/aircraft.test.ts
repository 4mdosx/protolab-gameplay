import { describe, expect, it } from 'vitest'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
import { aircraftConfigs, weapons, aiModules } from '../experiments/fleet-collection/config'
function setup() {
  const b=createDogfight(42,[3],[0],17,true)
  b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?20:70,y:50}))
  b.intel={blue:{'red-0':100},red:{'blue-0':100}}
  return b
}
describe('carrier aircraft',()=>{
  it('launches linked aircraft with independent AI and gun configuration',()=>{
    let b=stepDogfight(setup());expect(b.aircraft).toHaveLength(1)
    const plane=b.aircraft[0],config=aircraftConfigs[weapons.carrierAirGroup.summonId!]
    expect(plane.ownerId).toBe('blue-0');expect(plane.layer).toBe('air');expect(plane.ai.id).toBe(config.aiId);expect(plane.weaponSlots[0].weaponId).toBe(config.weaponId);expect(plane.ai.id).not.toBe(b.ships[0].ai.id)
    expect(b.ships[0].weaponSlots[0].readyAt).toBe(weapons.carrierAirGroup.cooldown)
    for(let i=0;i<200&&!b.result;i++)b=stepDogfight(b)
    expect(b.events.some(event=>event.includes('舰载机')&&event.includes('机炮')) || b.projectiles.some(p=>p.source.startsWith('air-'))).toBe(true)
  })
  it('respects per-carrier active limit and removes aircraft after owner loss',()=>{
    let b=setup()
    for(let i=0;i<4;i++){b.ships[0].weaponSlots[0].readyAt=0;b=stepDogfight(b)}
    expect(b.aircraft).toHaveLength(3)
    b.ships[0].hp=0;b=stepDogfight(b);expect(b.aircraft).toHaveLength(0);expect(b.result).toBe('red')
  })
  it('aircraft expire and do not decide victory without their carrier',()=>{
    let b=stepDogfight(setup());b.aircraft[0].expiresAt=b.time;b=stepDogfight(b);expect(b.aircraft).toHaveLength(0)
  })
  it('carrier and fighter have separately configured tactics',()=>{expect(aiModules.aviation.preferredRange).toBeGreaterThan(aiModules.fighter.preferredRange)})
  it('steers toward enemy ships while guns still engage a nearer aircraft',()=>{
    let b=setup()
    b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?0:90,y:40}))
    b=stepDogfight(b)
    const plane=b.aircraft[0]
    b.aircraft=[{...plane,x:72,y:40}]
    b.ships=b.ships.map(s=>s.id==='red-0'?{...s,x:90,y:40,weaponSlots:s.weaponSlots.map(slot=>({...slot,readyAt:0}))}:s)
    b.intel.red[plane.id]=100
    b.intel.red['blue-0']=100
    b=stepDogfight(b)
    const destroyer=b.ships.find(s=>s.id==='red-0')!
    expect(b.targets['red-0']).toBe('blue-0')
    expect(b.targets[plane.id]).toBe('red-0')
    expect(Object.values(b.targets)).not.toContain(plane.id)
    expect(destroyer.x).toBeLessThan(90)
    expect(b.projectiles.some(p=>p.source==='red-0'&&p.target===plane.id)).toBe(true)
  })
})

it('enforces aircraft capacity separately for each carrier weapon slot',()=>{
  let b=setup();const original=b.ships[0].weaponSlots[0]
  b.ships[0].weaponSlots=[{...original,slotId:'left',weapon:{...original.weapon,maxActive:1}},{...original,slotId:'right',weapon:{...original.weapon,maxActive:2}}]
  for(let i=0;i<4;i++){b.ships[0].weaponSlots=b.ships[0].weaponSlots.map(s=>({...s,readyAt:0}));b=stepDogfight(b)}
  expect(b.aircraft.filter(p=>p.ownerSlotId==='left')).toHaveLength(1)
  expect(b.aircraft.filter(p=>p.ownerSlotId==='right')).toHaveLength(2)
  expect(b.ships[0].weaponSlots.find(s=>s.slotId==='left')!.readyAt).toBe(0)
})
