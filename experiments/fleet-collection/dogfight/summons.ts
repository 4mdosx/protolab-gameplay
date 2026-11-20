import { resolveAircraft } from '../config'
import type { Battle, Ship } from '../battle/model'
import type { Dogfight } from './model'

/** Launching consumes the carrier slot cooldown; summoned units act starting next tick. */
export function launchAircraft(b: Dogfight, alive: Ship[], moved: Map<string, Ship>, intel: Battle['intel'], events: string[]) {
  let nextAircraft = b.nextAircraft
  const launched: Ship[] = []
  for (const carrier of alive.filter(s => !s.unitKind)) for (const slot of carrier.weaponSlots) {
    const weapon = slot.weapon
    if (weapon.delivery !== 'aircraft' || !weapon.summonId || b.time + 1e-9 < slot.readyAt) continue
    const target = alive.filter(t=>t.team!==carrier.team && !t.unitKind && (intel[carrier.team][t.id]??0)>=40).sort((a,c)=>Math.hypot(a.x-carrier.x,a.y-carrier.y)-Math.hypot(c.x-carrier.x,c.y-carrier.y)||a.id.localeCompare(c.id))[0]
    if (!target || Math.hypot(target.x-carrier.x,target.y-carrier.y) > weapon.range) continue
    const active = alive.filter(s=>s.unitKind==='aircraft' && s.ownerId===carrier.id && s.ownerSlotId===slot.slotId).length + launched.filter(s=>s.ownerId===carrier.id && s.ownerSlotId===slot.slotId).length
    if (active >= (weapon.maxActive ?? 0)) continue
    const config = resolveAircraft(weapon.summonId), pos = moved.get(carrier.id)!
    launched.push({ ...carrier, id: `air-${nextAircraft++}`, name: config.name, unitKind: 'aircraft', ownerId: carrier.id, ownerSlotId: slot.slotId, expiresAt: b.time + config.lifetime, layer: 'air', x: pos.x, y: pos.y, speed: config.speed, stats: config.stats, armor: config.armor, hp: config.stats.hp, ai: config.ai, preferredRange: config.ai.preferredRange, personality: config.ai.personality, weaponSlots: [{slotId:'main',weaponId:config.weaponId,weapon:config.weapon,readyAt:b.time+0.1}] })
    pos.weaponSlots = pos.weaponSlots.map(s=>s.slotId===slot.slotId?{...s,readyAt:b.time+weapon.cooldown}:s)
    events.push(`${carrier.team==='blue'?'蓝':'红'}方 ${carrier.name} 【${slot.slotId}】起飞 ${config.name}`)
  }
  return { launched, nextAircraft }
}
