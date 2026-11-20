import type { Battle, Ship } from '../battle/model'
import type { TerrainBox } from './terrain'
import type { Dogfight, Projectile } from './model'
import { terrainImpact } from './terrain'
import { hitTime, canAttack } from './combat'
const DT=0.1
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x))
const distance=(a:Ship,b:Ship)=>Math.hypot(a.x-b.x,a.y-b.y)
export function resolveProjectiles(b:Dogfight, alive:Ship[], moved:Map<string,Ship>, intel:Battle['intel'], obstacles:TerrainBox[], events:string[]) {
  let nextProjectile=b.nextProjectile, shots=b.shots, collisions=b.collisions, hits=b.hits, dodges=b.dodges
  const spawned: Projectile[]=[]
  for(const ship of [...alive].sort((a,c)=>a.id.localeCompare(c.id))) {
    const target=alive.filter(t=>t.team!==ship.team&&canAttack(ship,t)&&(intel[ship.team][t.id]??0)>=40).sort((a,c)=>distance(ship,a)-distance(ship,c)||a.id.localeCompare(c.id))[0]
    if(!target||distance(ship,target)>ship.weapon.range||b.time+1e-9<ship.readyAt||terrainImpact(ship,target,'surface',obstacles)!==null) continue
    const dx=target.x-ship.x,dy=target.y-ship.y,angle=Math.atan2(dy,dx), speed=ship.weapon.projectileSpeed
    // Three-projectile fan: total power equals the original single shot.
    for (const offset of ship.weapon.spread) spawned.push({id:nextProjectile++,team:ship.team,source:ship.id,target:target.id,x:ship.x,y:ship.y,vx:Math.cos(angle+offset)*speed,vy:Math.sin(angle+offset)*speed,remaining:ship.weapon.range,power:ship.stats.pwr*ship.weapon.power/ship.weapon.spread.length,damage:ship.weapon.damage,accuracy:ship.weapon.accuracy,acc:ship.stats.acc,layer:target.layer,lock:intel[ship.team][target.id]>=100?1:0.6})
    moved.get(ship.id)!.readyAt=b.time+ship.weapon.cooldown;shots+=ship.weapon.spread.length
    events.push(`${ship.team==='blue'?'蓝':'红'}方 ${ship.name} 发射${ship.weapon.id}弹幕（${ship.weapon.spread.length} 发）`)
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
  return {nextProjectile, shots, collisions, hits, dodges, projectiles, damage}
}
