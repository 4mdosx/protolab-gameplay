import type { Ship, Battle } from '../battle/model'
import type { Dogfight } from './model'
import type { TerrainBox } from './terrain'
import { terrainImpact } from './terrain'
import { findPath } from './pathfinding'
import { chooseCover, chooseFiringPosition } from './cover'
import { canAttack } from './combat'
const DT = 0.1
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)
export function moveFleet(b: Dogfight, alive: Ship[], intel: Battle['intel'], obstacles: TerrainBox[], events: string[]) {
  const moved = new Map<string,Ship>()
  const headings = { ...b.headings }
  const turnRates = { ...b.turnRates }
  const navigation = { ...b.navigation }
  const cover = { ...b.cover }
  const tactics = { ...b.tactics }
  const orbits: Dogfight['orbits'] = {}
  const engaged: Record<string, string> = {}
  for(const ship of alive) {
    // Movement never chases aircraft. Ships close on other ships, or on a scene goal such as cover.
    const hullTarget = ship.shipClass === 'carrier' && !ship.unitKind
    const candidates=alive.filter(t=>t.team!==ship.team&&!t.unitKind&&(hullTarget||ship.weaponSlots.some(slot=>canAttack(ship,t,slot.weapon)))&&(intel[ship.team][t.id]??0)>=40).sort((a,c)=>distance(ship,a)-distance(ship,c)||a.id.localeCompare(c.id))
    const target=candidates[0], dx=target?target.x-ship.x:ship.team==='blue'?1:-1, dy=target?target.y-ship.y:0, d=target?distance(ship,target):1
    const ux=dx/(d||1), uy=dy/(d||1), side=Number(ship.id.split('-').at(-1))%2===0?1:-1
    // Keep a standoff band: approach outside it, weave within it, disengage inside it.
    // Exact overlap gets a stable opposing direction instead of a zero-length vector.
    const minDistance = target ? Math.max(10, ship.ai.preferredRange * 0.65) : 0
    const tooClose = !!target && d < minDistance
    const awayX = d < 0.001 ? (ship.team === 'blue' ? -1 : 1) : -ux
    const awayY = d < 0.001 ? 0 : -uy
    const forward = target ? (d > ship.ai.preferredRange ? 0.8 : 0) : (ship.shipClass==='carrier' && !ship.unitKind ? 0 : 1)
    let vx = tooClose ? awayX * 2 - uy * side * 0.35 : ux * forward - uy * side * ship.ai.orbitStrength
    let vy = tooClose ? awayY * 2 + ux * side * 0.35 : uy * forward + ux * side * ship.ai.orbitStrength
    // Threat awareness uses only enemy projectiles already present on the field.
    const threat=b.projectiles.filter(p=>p.team!==ship.team).map(p=>{const rx=ship.x-p.x,ry=ship.y-p.y, vv=p.vx*p.vx+p.vy*p.vy, t=clamp((rx*p.vx+ry*p.vy)/(vv||1),0,0.8);return {p,t,miss:Math.hypot(rx-p.vx*t,ry-p.vy*t)}}).filter(x=>x.miss<5&&x.t>0).sort((a,c)=>a.t-c.t)[0]
    if(threat && !tooClose){const speed=Math.hypot(threat.p.vx,threat.p.vy)||1;const cross=threat.p.vx*(ship.y-threat.p.y)-threat.p.vy*(ship.x-threat.p.x);const sign=cross>=0?1:-1;vx+=-threat.p.vy/speed*sign*ship.ai.dodgeStrength;vy+=threat.p.vx/speed*sign*ship.ai.dodgeStrength}
    // Replan on a bounded cadence only when the direct approach is obstructed.
    const cached = navigation[ship.id]
    const nearTerrain = terrainImpact(ship, {x: ship.x + Math.cos(headings[ship.id] ?? Math.atan2(vy,vx))*20, y: ship.y + Math.sin(headings[ship.id] ?? Math.atan2(vy,vx))*20}, 'surface', obstacles, 4) !== null
    if (target && (ship.shipClass !== 'carrier' || !!ship.unitKind) && (nearTerrain || (cached?.waypoint && b.time < cached.nextCheck))) {
      let plan = cached
      if (!plan || plan.targetId !== target.id || b.time >= plan.nextCheck || (plan.waypoint && distance(ship,plan.waypoint)<5)) {
        const path=findPath(ship,target,'surface',obstacles)
        // Pick the furthest visible waypoint to reduce zigzagging.
        let waypoint=path?.[0] ?? null
        if(path)for(const candidate of path){if(terrainImpact(ship,candidate,'surface',obstacles,4)!==null)break;waypoint=candidate}
        plan={targetId:target.id,nextCheck:b.time+2,waypoint};navigation[ship.id]=plan
      }
      if(plan.waypoint){vx=plan.waypoint.x-ship.x;vy=plan.waypoint.y-ship.y}
    } else if (cached && (!target || b.time >= cached.nextCheck)) delete navigation[ship.id]
    // Ready weapons seek a clear firing position; during cooldown seek cover.
    const mode = !target ? 'search' : tooClose ? 'evade' : b.time + 1e-9 < ship.weaponSlots[0].readyAt ? 'cover' : 'attack'
    if (tactics[ship.id] !== mode) {
      tactics[ship.id] = mode
      if (mode === 'cover' || mode === 'attack') events.push(`${ship.team==='blue'?'蓝':'红'}方 ${ship.name} ${mode==='cover'?'冷却：寻找掩体':'就绪：寻找射击路线'}`)
      delete cover[ship.id]
    }
    if (target) { engaged[ship.id] = target.id; orbits[ship.id] = {x: target.x, y: target.y, kind: 'enemy'} }
    if (target && !tooClose && (ship.shipClass !== 'carrier' || !!ship.unitKind)) {
      const blockedView = terrainImpact(ship,target,'surface',obstacles)!==null
      const needGoal = (mode === 'cover' && ship.ai.useCover) || (mode === 'attack' && (blockedView || d > ship.weaponSlots[0].weapon.range))
      let plan = cover[ship.id]
      if (needGoal && (!plan || plan.targetId !== target.id || b.time >= plan.retryAt)) {
        const coverFound = mode === 'cover' ? chooseCover(ship,target,'surface',obstacles) : null
        const found = coverFound ?? (mode === 'attack' ? chooseFiringPosition(ship,target,'surface',ship.weaponSlots[0].weapon.range,obstacles) : null)
        plan={targetId:target.id,goal:found?.goal??null,waypoint:found?.waypoint??null,replanAt:b.time+1,until:Infinity,retryAt:b.time+2,anchor:coverFound?.anchor,radius:coverFound?.radius};cover[ship.id]=plan
      }
      if(needGoal && plan?.goal) {
        if(mode==='cover' && plan.anchor && distance(ship,plan.goal)<Math.max(12, (plan.radius ?? 15))) {
          const ox=ship.x-plan.anchor.x, oy=ship.y-plan.anchor.y, od=Math.hypot(ox,oy)||1, radial=clamp(((plan.radius??15)-od)*0.12,-0.8,0.8)
          vx=-oy/od*side+ox/od*radial;vy=ox/od*side+oy/od*radial
          orbits[ship.id]={...plan.anchor,kind:'building'}
        } else {
          if(b.time>=plan.replanAt || (plan.waypoint && distance(ship,plan.waypoint)<4)) {
            const path=findPath(ship,plan.goal,'surface',obstacles,400);let waypoint=path?.[0]??null
            if(path)for(const candidate of path){if(terrainImpact(ship,candidate,'surface',obstacles,4)!==null)break;waypoint=candidate}
            plan={...plan,waypoint,replanAt:b.time+1};cover[ship.id]=plan
          }
          if(plan.waypoint){vx=plan.waypoint.x-ship.x;vy=plan.waypoint.y-ship.y}
        }
      }
    }
    // Angular velocity and acceleration create turning inertia and a minimum turn radius.
    const desired = Math.atan2(vy, vx)
    const previous = headings[ship.id] ?? desired
    const delta = Math.atan2(Math.sin(desired - previous), Math.cos(desired - previous))
    const desiredRate = clamp(delta * 2, -ship.ai.turnRate, ship.ai.turnRate)
    const oldRate = turnRates[ship.id] ?? 0
    const turnRate = oldRate + clamp(desiredRate - oldRate, -ship.ai.turnAcceleration * DT, ship.ai.turnAcceleration * DT)
    const heading = previous + turnRate * DT
    headings[ship.id] = heading
    turnRates[ship.id] = turnRate
    const speed=ship.speed*3
    const next = { x: ship.x + Math.cos(heading)*speed*DT, y: ship.y + Math.sin(heading)*speed*DT }
    const blocked = terrainImpact(ship, next, 'surface', obstacles, 2)
    const fraction = blocked === null ? 1 : Math.max(0, blocked - 0.001)
    moved.set(ship.id,{...ship,x:ship.x+(next.x-ship.x)*fraction,y:ship.y+(next.y-ship.y)*fraction})
  }
  return { moved, headings, turnRates, navigation, cover, tactics, orbits, targets: engaged }
}
