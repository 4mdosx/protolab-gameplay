import type { Layer } from '../battle/model'
import { terrainImpact, type TerrainBox } from './terrain'
type Point = { x: number; y: number }
/** Bounded, local A*: obstacle clearance is conservative, and diagonal corner-cutting is forbidden. */
export function findPath(start: Point, goal: Point, layer: Layer, boxes: TerrainBox[], limit = 800): Point[] | null {
  if (terrainImpact(start, goal, layer, boxes, 4) === null) return [goal]
  const cell = 6, sx=Math.round(start.x/cell), sy=Math.round(start.y/cell), gx=Math.round(goal.x/cell), gy=Math.round(goal.y/cell)
  const key=(x:number,y:number)=>`${x},${y}`, heuristic=(x:number,y:number)=>Math.hypot(x-gx,y-gy)
  const open = [{x:sx,y:sy,g:0,f:heuristic(sx,sy)}], costs=new Map([[key(sx,sy),0]]), parent=new Map<string,string>(), closed=new Set<string>()
  const coords=(k:string):Point=>{const [x,y]=k.split(',').map(Number);return {x:x*cell,y:y*cell}}
  let visits=0
  while(open.length && visits++ < limit) {
    open.sort((a,b)=>a.f-b.f || a.x-b.x || a.y-b.y); const current=open.shift()!, ck=key(current.x,current.y)
    if(closed.has(ck))continue;closed.add(ck)
    if(current.x===gx && current.y===gy){const path:Point[]=[];let k=ck;while(k!==key(sx,sy)){path.push(coords(k));k=parent.get(k)!}path.reverse();if(!path.length)return [goal];return path}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx=current.x+dx,ny=current.y+dy,nk=key(nx,ny),a={x:current.x*cell,y:current.y*cell},b={x:nx*cell,y:ny*cell}
      if(closed.has(nk)||terrainImpact(a,b,layer,boxes,4)!==null)continue
      const cost=current.g+Math.hypot(dx,dy);if(cost >= (costs.get(nk)??Infinity))continue
      costs.set(nk,cost);parent.set(nk,ck);open.push({x:nx,y:ny,g:cost,f:cost+heuristic(nx,ny)})
    }
  }
  return null
}
