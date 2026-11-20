import { describe, expect, it } from 'vitest'
import { findPath } from '../experiments/fleet-collection/dogfight/pathfinding'
import { terrainImpact } from '../experiments/fleet-collection/dogfight/terrain'
import { generateChunk, waterAt } from '../experiments/fleet-collection/dogfight/city'
describe('terrain-aware routes',()=>{
  it('routes around a building with clearance and bypasses it in air',()=>{const boxes=[{id:'wall',x:18,y:-8,width:12,height:16,blocks:['surface'] as ('surface')[]}],start={x:0,y:0},goal={x:48,y:0};const path=findPath(start,goal,'surface',boxes)!;expect(path).toBeTruthy();let last=start;for(const p of path){expect(terrainImpact(last,p,'surface',boxes,4)).toBeNull();last=p}expect(findPath(start,goal,'air',boxes)).toEqual([goal])})
  it('does not place buildings over waterways',()=>{for(let cx=-2;cx<=2;cx++)for(let cy=-1;cy<=3;cy++)for(const b of generateChunk(17,cx,cy).buildings)for(let x=b.x;x<=b.x+b.width;x+=2)for(let y=b.y;y<=b.y+b.height;y+=2)expect(waterAt(17,x,y)).toBe(false)})
})
