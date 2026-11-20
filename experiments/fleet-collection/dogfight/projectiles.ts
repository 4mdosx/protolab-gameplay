import type { Battle, Ship } from '../battle/model'
import type { TerrainBox } from './terrain'
import type { Dogfight, Projectile } from './model'
import { terrainImpact } from './terrain'
import { hitTime, canAttack } from './combat'
const DT=0.1
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x))
const distance=(a:Ship,b:Ship)=>Math.hypot(a.x-b.x,a.y-b.y)
export function resolveProjectiles(b:Dogfight, alive:Ship[], moved:Map<string,Ship>, intel:Battle['intel'], obstacles:TerrainBox[], events:string[], aimState: { headings: Record<string, number>; turrets: Record<string, number> } = { headings: {}, turrets: {} }) {
  let nextProjectile=b.nextProjectile, shots=b.shots, collisions=b.collisions, hits=b.hits, dodges=b.dodges
  const spawned: Projectile[]=[]
  const turrets = { ...aimState.turrets }
  const recoil: Record<string, { x: number; y: number }> = {}
  for(const ship of [...alive].sort((a,c)=>a.id.localeCompare(c.id))) {
    for (const mount of ship.weaponSlots) {
      const weapon = mount.weapon
      const target=alive.filter(t=>t.team!==ship.team&&canAttack(ship,t,weapon)&&(intel[ship.team][t.id]??0)>=40).sort((a,c)=>distance(ship,a)-distance(ship,c)||a.id.localeCompare(c.id))[0]
      if(!target||distance(ship,target)>weapon.range||b.time+1e-9<mount.readyAt||terrainImpact(ship,target,'surface',obstacles)!==null) continue
      let angle=Math.atan2(target.y-ship.y,target.x-ship.x)
      if (weapon.arc && weapon.traverse) {
        const heading = aimState.headings[ship.id] ?? angle
        const key = `${ship.id}:${mount.slotId}`
        const local = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading))
        const wanted = clamp(local, -weapon.arc, weapon.arc)
        const turret = turrets[key] ?? 0
        const nextTurret = turret + clamp(wanted - turret, -weapon.traverse * DT, weapon.traverse * DT)
        turrets[key] = nextTurret
        const gap = Math.abs(Math.atan2(Math.sin(local - nextTurret), Math.cos(local - nextTurret)))
        if (gap > 0.15 || Math.abs(local) > weapon.arc + 1e-3) continue
        angle = heading + nextTurret
        if (weapon.recoil) { const kick = recoil[ship.id] ?? { x: 0, y: 0 }; recoil[ship.id] = { x: kick.x - Math.cos(angle) * weapon.recoil, y: kick.y - Math.sin(angle) * weapon.recoil } }
      }
      const speed=weapon.projectileSpeed
      for (const offset of weapon.spread) spawned.push({id:nextProjectile++,team:ship.team,source:ship.id,target:target.id,x:ship.x,y:ship.y,vx:Math.cos(angle+offset)*speed,vy:Math.sin(angle+offset)*speed,remaining:weapon.range,power:ship.stats.pwr*weapon.power/weapon.spread.length,damage:weapon.damage,accuracy:weapon.accuracy,acc:ship.stats.acc,layer:target.layer,lock:intel[ship.team][target.id]>=100?1:0.6})
      const next = moved.get(ship.id)!
      next.weaponSlots = next.weaponSlots.map(slot => slot.slotId === mount.slotId ? { ...slot, readyAt: b.time + weapon.cooldown } : slot)
      shots+=weapon.spread.length
      events.push(`${ship.team==='blue'?'蓝':'红'}方 ${ship.name} 发射${weapon.id}（${weapon.model} · ${weapon.spread.length} 发）`)
    }
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
  return {nextProjectile, shots, collisions, hits, dodges, projectiles, damage, turrets, recoil}
}
