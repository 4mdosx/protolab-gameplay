import { createBattle, type Battle, type Ship, type Team, type Layer } from '../battle/model'
import { terrainImpact, type TerrainBox } from './terrain'
import { generateCity, updateCity, type CityMap } from './city'
import { findPath } from './pathfinding'
import { chooseCover, chooseFiringPosition } from './cover'

export interface Projectile { id: number; team: Team; source: string; target: string; x: number; y: number; vx: number; vy: number; remaining: number; power: number; damage: 'kinetic' | 'underwater'; accuracy: number; acc: number; lock: number; layer?: Layer }
export interface Dogfight extends Battle { projectiles: Projectile[]; nextProjectile: number; shots: number; collisions: number; hits: number; dodges: number; headings: Record<string, number>; turnRates: Record<string, number>; terrain: TerrainBox[]; city: CityMap; navigation: Record<string, { targetId: string; nextCheck: number; waypoint: {x:number;y:number} | null }>; cover: Record<string, { targetId: string; goal: {x:number;y:number} | null; waypoint: {x:number;y:number} | null; replanAt: number; until: number; retryAt: number }>; tactics: Record<string, 'search' | 'cover' | 'attack' | 'evade'> }
export const DT = 0.1
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x-b.x,a.y-b.y)
export function createDogfight(seed: number, lineup: number[] = [0, 1, 2], red: number[] = [0, 1, 2], mapSeed = 17): Dogfight {
  const city = generateCity(mapSeed)
  return { ...createBattle(seed, lineup, red), projectiles: [], nextProjectile: 0, shots: 0, collisions: 0, hits: 0, dodges: 0, headings: {}, turnRates: {}, terrain: city.buildings, city, navigation: {}, cover: {}, tactics: {} }
}
// Relative-motion segment test catches projectiles that cross a moving target between updates.
export function hitTime(p: {x:number;y:number}, q: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}, radius: number): number | null {
  const x = p.x-a.x, y = p.y-a.y, vx = q.x-p.x-(b.x-a.x), vy = q.y-p.y-(b.y-a.y)
  const c=x*x+y*y-radius*radius
  if(c<=0) return 0
  const aa=vx*vx+vy*vy, bb=2*(x*vx+y*vy), discriminant=bb*bb-4*aa*c
  if(aa===0||discriminant<0) return null
  const t=(-bb-Math.sqrt(discriminant))/(2*aa)
  return t>=0&&t<=1?t:null
}
export function sweptHit(p: {x:number;y:number}, q: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}, radius: number): boolean {
  return hitTime(p,q,a,b,radius)!==null
}
export function canAttack(ship: Ship, target: Ship): boolean {
  if (ship.shipClass === 'aircraft') return true
  return ship.weapon.delivery === 'torpedo' ? target.layer !== 'air' : target.layer !== 'submerged'
}
export function stepDogfight(b: Dogfight): Dogfight {
  if (b.result) return b
  const alive = b.ships.filter(s => s.hp > 0)
  const city = updateCity(b.city, [...alive, ...b.projectiles])
  const obstacles = city === b.city ? b.terrain : city.buildings
  const intel: Battle['intel'] = {blue:{...b.intel.blue},red:{...b.intel.red}}, events: string[] = []
  for (const team of ['blue','red'] as Team[]) for (const target of alive.filter(s=>s.team!==team)) {
    const sensors = alive.filter(s=>s.team===team).map(s=>s.stats.sen/(1+(distance(s,target)/60)**2)).sort((a,c)=>c-a)
    const strength=(sensors[0]??0)+0.3*sensors.slice(1).reduce((a,c)=>a+c,0), prev=intel[team][target.id]??0
    const value=clamp(prev+8*2*strength/(strength+target.stats.stl)*DT,0,100); intel[team][target.id]=value
    if(prev<40&&value>=40) events.push(`${team==='blue'?'蓝方':'红方'}发现 ${target.name}`)
    if(prev<100&&value>=100) events.push(`${team==='blue'?'蓝方':'红方'}锁定 ${target.name}`)
  }
  const moved = new Map<string,Ship>()
  const headings = { ...b.headings }
  const turnRates = { ...b.turnRates }
  const navigation = { ...b.navigation }
  const cover = { ...b.cover }
  const tactics = { ...b.tactics }
  for(const ship of alive) {
    const targets=alive.filter(t=>t.team!==ship.team&&canAttack(ship,t)&&(intel[ship.team][t.id]??0)>=40).sort((a,c)=>distance(ship,a)-distance(ship,c)||a.id.localeCompare(c.id))
    const target=targets[0], dx=target?target.x-ship.x:ship.team==='blue'?1:-1, dy=target?target.y-ship.y:0, d=target?distance(ship,target):1
    const ux=dx/(d||1), uy=dy/(d||1), side=Number(ship.id.split('-')[1])%2===0?1:-1
    // Keep a standoff band: approach outside it, weave within it, disengage inside it.
    // Exact overlap gets a stable opposing direction instead of a zero-length vector.
    const minDistance = target ? Math.max(10, ship.preferredRange * 0.65) : 0
    const tooClose = !!target && d < minDistance
    const awayX = d < 0.001 ? (ship.team === 'blue' ? -1 : 1) : -ux
    const awayY = d < 0.001 ? 0 : -uy
    const forward = target ? (d > ship.preferredRange ? 0.8 : 0) : 1
    let vx = tooClose ? awayX * 2 - uy * side * 0.35 : ux * forward - uy * side * 0.9
    let vy = tooClose ? awayY * 2 + ux * side * 0.35 : uy * forward + ux * side * 0.9
    // Threat awareness uses only enemy projectiles already present on the field.
    const threat=b.projectiles.filter(p=>p.team!==ship.team).map(p=>{const rx=ship.x-p.x,ry=ship.y-p.y, vv=p.vx*p.vx+p.vy*p.vy, t=clamp((rx*p.vx+ry*p.vy)/(vv||1),0,0.8);return {p,t,miss:Math.hypot(rx-p.vx*t,ry-p.vy*t)}}).filter(x=>x.miss<5&&x.t>0).sort((a,c)=>a.t-c.t)[0]
    if(threat && !tooClose){const speed=Math.hypot(threat.p.vx,threat.p.vy)||1;const cross=threat.p.vx*(ship.y-threat.p.y)-threat.p.vy*(ship.x-threat.p.x);const sign=cross>=0?1:-1;vx+=-threat.p.vy/speed*sign*2;vy+=threat.p.vx/speed*sign*2}
    // Replan on a bounded cadence only when the direct approach is obstructed.
    const cached = navigation[ship.id]
    const nearTerrain = terrainImpact(ship, {x: ship.x + Math.cos(headings[ship.id] ?? Math.atan2(vy,vx))*20, y: ship.y + Math.sin(headings[ship.id] ?? Math.atan2(vy,vx))*20}, ship.layer, obstacles, 4) !== null
    if (target && ship.layer !== 'air' && (nearTerrain || (cached?.waypoint && b.time < cached.nextCheck))) {
      let plan = cached
      if (!plan || plan.targetId !== target.id || b.time >= plan.nextCheck || (plan.waypoint && distance(ship,plan.waypoint)<5)) {
        const path=findPath(ship,target,ship.layer,obstacles)
        // Pick the furthest visible waypoint to reduce zigzagging.
        let waypoint=path?.[0] ?? null
        if(path)for(const candidate of path){if(terrainImpact(ship,candidate,ship.layer,obstacles,4)!==null)break;waypoint=candidate}
        plan={targetId:target.id,nextCheck:b.time+2,waypoint};navigation[ship.id]=plan
      }
      if(plan.waypoint){vx=plan.waypoint.x-ship.x;vy=plan.waypoint.y-ship.y}
    } else if (cached && (!target || b.time >= cached.nextCheck)) delete navigation[ship.id]
    // Ready weapons seek a clear firing position; during cooldown seek cover.
    const mode = !target ? 'search' : tooClose ? 'evade' : b.time + 1e-9 < ship.readyAt ? 'cover' : 'attack'
    if (tactics[ship.id] !== mode) {
      tactics[ship.id] = mode
      if (mode === 'cover' || mode === 'attack') events.push(`${ship.team==='blue'?'蓝':'红'}方 ${ship.name} ${mode==='cover'?'冷却：寻找掩体':'就绪：寻找射击路线'}`)
      delete cover[ship.id]
    }
    let holding = false
    if (target && !tooClose && ship.layer !== 'air') {
      const blockedView = terrainImpact(ship,target,'surface',obstacles)!==null
      const needGoal = mode === 'cover' || (mode === 'attack' && (blockedView || d > ship.weapon.range))
      let plan = cover[ship.id]
      if (needGoal && (!plan || plan.targetId !== target.id || b.time >= plan.retryAt)) {
        const found = mode === 'cover' ? chooseCover(ship,target,ship.layer,obstacles) : chooseFiringPosition(ship,target,ship.layer,ship.weapon.range,obstacles)
        plan={targetId:target.id,goal:found?.goal??null,waypoint:found?.waypoint??null,replanAt:b.time+1,until:Infinity,retryAt:b.time+2};cover[ship.id]=plan
      }
      if(needGoal && plan?.goal) {
        if(mode==='cover' && distance(ship,plan.goal)<3 && terrainImpact(ship,target,'surface',obstacles)!==null) holding=true
        else {
          if(b.time>=plan.replanAt || (plan.waypoint && distance(ship,plan.waypoint)<4)) {
            const path=findPath(ship,plan.goal,ship.layer,obstacles,400);let waypoint=path?.[0]??null
            if(path)for(const candidate of path){if(terrainImpact(ship,candidate,ship.layer,obstacles,4)!==null)break;waypoint=candidate}
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
    const desiredRate = clamp(delta * 2, -0.8, 0.8)
    const oldRate = turnRates[ship.id] ?? 0
    const turnRate = oldRate + clamp(desiredRate - oldRate, -1.2 * DT, 1.2 * DT)
    const heading = previous + turnRate * DT
    headings[ship.id] = heading
    turnRates[ship.id] = turnRate
    const speed=holding ? 0 : ship.speed*3
    const next = { x: ship.x + Math.cos(heading)*speed*DT, y: ship.y + Math.sin(heading)*speed*DT }
    const blocked = terrainImpact(ship, next, ship.layer, obstacles, 2)
    const fraction = blocked === null ? 1 : Math.max(0, blocked - 0.001)
    moved.set(ship.id,{...ship,x:ship.x+(next.x-ship.x)*fraction,y:ship.y+(next.y-ship.y)*fraction})
  }
  let nextProjectile=b.nextProjectile, shots=b.shots, collisions=b.collisions, hits=b.hits, dodges=b.dodges
  const spawned: Projectile[]=[]
  for(const ship of [...alive].sort((a,c)=>a.id.localeCompare(c.id))) {
    const target=alive.filter(t=>t.team!==ship.team&&canAttack(ship,t)&&(intel[ship.team][t.id]??0)>=40).sort((a,c)=>distance(ship,a)-distance(ship,c)||a.id.localeCompare(c.id))[0]
    if(!target||distance(ship,target)>ship.weapon.range||b.time+1e-9<ship.readyAt||terrainImpact(ship,target,'surface',obstacles)!==null) continue
    const dx=target.x-ship.x,dy=target.y-ship.y,angle=Math.atan2(dy,dx), speed=30
    // Three-projectile fan: total power equals the original single shot.
    for (const offset of [-0.14, 0, 0.14]) spawned.push({id:nextProjectile++,team:ship.team,source:ship.id,target:target.id,x:ship.x,y:ship.y,vx:Math.cos(angle+offset)*speed,vy:Math.sin(angle+offset)*speed,remaining:ship.weapon.range,power:ship.stats.pwr*ship.weapon.power/3,damage:ship.weapon.damage,accuracy:ship.weapon.accuracy,acc:ship.stats.acc,layer:target.layer,lock:intel[ship.team][target.id]>=100?1:0.6})
    moved.get(ship.id)!.readyAt=b.time+ship.weapon.cooldown;shots+=3
    events.push(`${ship.team==='blue'?'蓝':'红'}方 ${ship.name} 发射${ship.weapon.id}弹幕（3 发）`)
  }
  const damage=new Map<string,number>(), projectiles:Projectile[]=[]
  for(const p of [...b.projectiles,...spawned]) {
    const q={x:p.x+p.vx*DT,y:p.y+p.vy*DT}, remaining=p.remaining-Math.hypot(p.vx,p.vy)*DT
    // Check every opposing moving hitbox and choose the first impact along the path.
    const impact = alive.filter(s=>s.team!==p.team && s.layer===(p.layer ?? 'surface')).map(target=>({target, t: hitTime(p,q,target,moved.get(target.id)!,3)})).filter((x): x is {target: Ship; t: number} => x.t !== null).sort((a,c)=>a.t-c.t || a.target.id.localeCompare(c.target.id))[0]
    const obstacle = terrainImpact(p, q, 'surface', obstacles)
    if (obstacle !== null && (!impact || obstacle <= impact.t)) { dodges++; events.push('弹幕被地形阻挡') }
    else if(impact) {
      const target=impact.target
      collisions++
      const chance=clamp(p.accuracy*2*p.acc/(p.acc+target.stats.eva)*p.lock,0.05,0.95)
      if(b.random()<chance){const amount=p.power*100/(100+target.stats.def*target.armor[p.damage]);damage.set(target.id,(damage.get(target.id)??0)+amount);hits++;events.push(`${target.team==='blue'?'蓝':'红'}方 ${target.name} 命中 ${amount.toFixed(1)}`)}
      else events.push(`${target.team==='blue'?'蓝':'红'}方 ${target.name} 闪避判定成功`)
    } else if(remaining<=0){dodges++;events.push('弹道未命中目标')}
    else projectiles.push({...p,...q,remaining})
  }
  const ships=b.ships.map(s=>{const m=moved.get(s.id)??s,hp=Math.max(0,m.hp-(damage.get(s.id)??0));if(s.hp>0&&hp===0)events.push(`${s.team==='blue'?'蓝':'红'}方 ${s.name}退出战斗`);return {...m,hp}})
  const blue=ships.some(s=>s.team==='blue'&&s.hp>0),red=ships.some(s=>s.team==='red'&&s.hp>0),tick=b.tick+1,time=Math.round(tick*DT*10)/10
  const result=!blue&&!red?'draw':!blue?'red':!red?'blue':time>=180?'draw':null
  return {...b,city,terrain: obstacles,ships,intel,headings,turnRates,navigation,cover,tactics,projectiles,nextProjectile,shots,collisions,hits,dodges,tick,time,result,events:[...b.events,...events.map(e=>`${time.toFixed(1)}s ${e}`)].slice(-120)}
}
