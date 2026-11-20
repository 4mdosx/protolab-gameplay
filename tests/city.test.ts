import { describe, expect, it } from 'vitest'
import { generateCity, generateChunk, updateCity, coastY, CHUNK_SIZE } from '../experiments/fleet-collection/dogfight/city'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
import { boxEntry } from '../experiments/fleet-collection/dogfight/terrain'
describe('chunked waterfront', () => {
  it('reproduces chunks independent of order, unloading and combat seed', () => { const a=generateCity(17);const b=updateCity(a,[{x:500,y:200}]);const c=updateCity(b,[{x:15,y:50},{x:105,y:50}]);expect(c.buildings).toEqual(a.buildings);expect(createDogfight(1,[0],[0],17).terrain).toEqual(createDogfight(2,[0],[0],17).terrain);expect(generateChunk(17,5,-3)).toEqual(generateChunk(17,5,-3)) })
  it('places buildings on land and protects spawn and central lane', () => { for(let seed=0;seed<30;seed++){const city=generateCity(seed), b=createDogfight(42,[0,1,2,0,1,2],[0,1,2,0,1,2],seed);for(const box of city.buildings){for(let n=0;n<=8;n++)expect(box.y).toBeGreaterThanOrEqual(coastY(seed,box.x+box.width*n/8));for(const ship of b.ships)expect(boxEntry(ship,ship,box,2)).toBeNull();expect(boxEntry({x:25,y:55},{x:95,y:55},box,2)).toBeNull()}} })
  it('loads new chunks when units move and discards distant chunks', () => { let b=createDogfight(3,[0],[0]);b.ships=b.ships.map(s=>({...s,x:s.x+CHUNK_SIZE*5,y:s.y+CHUNK_SIZE*5}));b=stepDogfight(b);expect(Object.keys(b.city.chunks).some(k=>k.startsWith('5,'))).toBe(true);expect(Object.keys(b.city.chunks).length).toBeLessThanOrEqual(18);expect(Object.keys(b.city.chunks)).not.toContain('-1,-1') })
})

it('generates low buildings as non-blocking and towers as blocking', async () => {
  const { terrainImpact } = await import('../experiments/fleet-collection/dogfight/terrain')
  const buildings = Array.from({length: 12},(_,i)=>generateChunk(17,i,1).buildings).flat()
  const low=buildings.find(b=>b.kind==='low')!, tall=buildings.find(b=>b.kind==='tower')!
  expect(low).toBeTruthy();expect(tall).toBeTruthy()
  for(const [building, blocked] of [[low,false],[tall,true]] as const){const a={x:building.x-2,y:building.y+building.height/2},b={x:building.x+building.width+2,y:a.y};expect(terrainImpact(a,b,'surface',[building])!==null).toBe(blocked)}
})
