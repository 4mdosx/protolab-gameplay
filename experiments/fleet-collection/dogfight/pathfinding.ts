import type { Layer } from '../battle/model'
import { terrainImpact, type TerrainBox } from './terrain'
type Point = { x: number; y: number }
/** Bounded local A*. Clearance is conservative, diagonal corner-cutting is forbidden, and a start inside a tower begins at the nearest clear cell. */
function clearStart(sx: number, sy: number, layer: Layer, boxes: TerrainBox[], cell: number): { x: number; y: number } | null {
  const at = (x: number, y: number) => ({ x: x * cell, y: y * cell })
  if (terrainImpact(at(sx, sy), at(sx, sy), layer, boxes, 4) === null) return { x: sx, y: sy }
  for (let r = 1; r <= 5; r++) {
    const ring: { x: number; y: number }[] = []
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push({ x: sx + dx, y: sy + dy })
    ring.sort((a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy) || a.x - b.x || a.y - b.y)
    for (const c of ring) if (terrainImpact(at(c.x, c.y), at(c.x, c.y), layer, boxes, 4) === null) return c
  }
  return null
}
export function findPath(start: Point, goal: Point, layer: Layer, boxes: TerrainBox[], limit = 800): Point[] | null {
  if (terrainImpact(start, goal, layer, boxes, 4) === null) return [goal]
  const cell = 6, gx=Math.round(goal.x/cell), gy=Math.round(goal.y/cell)
  const origin = clearStart(Math.round(start.x/cell), Math.round(start.y/cell), layer, boxes, cell)
  if (!origin) return null
  const sx = origin.x, sy = origin.y
  const escaped = sx !== Math.round(start.x/cell) || sy !== Math.round(start.y/cell) ? { x: sx * cell, y: sy * cell } : null
  const key=(x:number,y:number)=>`${x},${y}`, heuristic=(x:number,y:number)=>Math.hypot(x-gx,y-gy)
  const open = [{x:sx,y:sy,g:0,f:heuristic(sx,sy)}], costs=new Map([[key(sx,sy),0]]), parent=new Map<string,string>(), closed=new Set<string>()
  const coords=(k:string):Point=>{const [x,y]=k.split(',').map(Number);return {x:x*cell,y:y*cell}}
  let visits=0
  while(open.length && visits++ < limit) {
    open.sort((a,b)=>a.f-b.f || a.x-b.x || a.y-b.y); const current=open.shift()!, ck=key(current.x,current.y)
    if(closed.has(ck))continue;closed.add(ck)
    if(current.x===gx && current.y===gy){const path:Point[]=[];let k=ck;while(k!==key(sx,sy)){path.push(coords(k));k=parent.get(k)!}path.reverse();if(!path.length)path.push({x:gx*cell,y:gy*cell});if(escaped && (path[0].x!==escaped.x||path[0].y!==escaped.y))path.unshift(escaped);return path}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx=current.x+dx,ny=current.y+dy,nk=key(nx,ny),a={x:current.x*cell,y:current.y*cell},b={x:nx*cell,y:ny*cell}
      if(closed.has(nk)||terrainImpact(a,b,layer,boxes,4)!==null)continue
      const cost=current.g+Math.hypot(dx,dy);if(cost >= (costs.get(nk)??Infinity))continue
      costs.set(nk,cost);parent.set(nk,ck);open.push({x:nx,y:ny,g:cost,f:cost+heuristic(nx,ny)})
    }
  }
  return null
}
