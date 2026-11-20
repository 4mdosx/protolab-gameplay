import type { Layer } from '../battle/model'
import { terrainImpact, type TerrainBox } from './terrain'
import { findPath } from './pathfinding'
type Point = {x:number;y:number}
/** Candidate position must be outside expanded buildings and occluded from the visible enemy. */
export function chooseCover(ship: Point, enemy: Point, layer: Layer, boxes: TerrainBox[]): { goal: Point; waypoint: Point; anchor: Point; radius: number } | null {
  const candidates: { goal: Point; distance: number; anchor: Point; radius: number }[] = []
  for (const box of boxes) {
    if (!box.blocks.includes('surface')) continue
    const cx=box.x+box.width/2,cy=box.y+box.height/2
    if (Math.hypot(cx-ship.x,cy-ship.y)>55) continue
    const points=[{x:box.x-7,y:cy},{x:box.x+box.width+7,y:cy},{x:cx,y:box.y-7},{x:cx,y:box.y+box.height+7}]
    for(const goal of points) {
      if(terrainImpact(goal,goal,layer,boxes,4)!==null || terrainImpact(enemy,goal,'surface',boxes)===null) continue
      candidates.push({goal,distance:Math.hypot(goal.x-ship.x,goal.y-ship.y),anchor:{x:cx,y:cy},radius:Math.max(box.width,box.height)/2+10})
    }
  }
  candidates.sort((a,b)=>(a.distance + Math.hypot(a.goal.x-enemy.x,a.goal.y-enemy.y)*0.35)-(b.distance + Math.hypot(b.goal.x-enemy.x,b.goal.y-enemy.y)*0.35) || a.goal.x-b.goal.x || a.goal.y-b.goal.y)
  for(const {goal,anchor,radius} of candidates.slice(0,8)) {
    const path=findPath(ship,goal,layer,boxes,400)
    if(!path)continue
    let waypoint=path[0]
    for(const candidate of path){if(terrainImpact(ship,candidate,layer,boxes,4)!==null)break;waypoint=candidate}
    return {goal,waypoint,anchor,radius}
  }
  return null
}

/** Find a reachable firing position with clear line of sight and valid range. */
export function chooseFiringPosition(ship: Point, enemy: Point, layer: Layer, range: number, boxes: TerrainBox[]): { goal: Point; waypoint: Point } | null {
  const candidates: Point[] = []
  for (const box of boxes) {
    if (Math.hypot(box.x + box.width/2-ship.x,box.y+box.height/2-ship.y)>65) continue
    for (const x of [box.x-8,box.x+box.width+8]) for (const y of [box.y-8,box.y+box.height+8]) candidates.push({x,y})
  }
  for(let i=0;i<12;i++){const a=i*Math.PI/6;candidates.push({x:enemy.x+Math.cos(a)*range*.75,y:enemy.y+Math.sin(a)*range*.75})}
  const viable=candidates.filter(p=>Math.hypot(p.x-enemy.x,p.y-enemy.y)<=range*.95 && terrainImpact(p,p,layer,boxes,4)===null && terrainImpact(p,enemy,'surface',boxes)===null)
  viable.sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y)||a.x-b.x||a.y-b.y)
  for(const goal of viable.slice(0,10)){const path=findPath(ship,goal,layer,boxes,400);if(!path)continue;let waypoint=path[0];for(const candidate of path){if(terrainImpact(ship,candidate,layer,boxes,4)!==null)break;waypoint=candidate}return {goal,waypoint}}
  return null
}
