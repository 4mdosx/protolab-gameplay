import { createRandom } from '../../../packages/simulation'

import { characters, resolveCharacter, type Team, type Layer, type ShipClass, type Stats, type DamageType, type Personality, type Weapon, type AiModule } from '../config'
export type { Team, Layer, ShipClass, Stats, DamageType, Personality, Weapon, AiModule } from '../config'
export interface Ship { unitKind?: 'aircraft'; ownerId?: string; ownerSlotId?: string; expiresAt?: number; shipClass: ShipClass; layer: Layer; id: string; name: string; team: Team; x: number; y: number; speed: number; preferredRange: number; personality: Personality; stats: Stats; hp: number; armor: Record<DamageType, number>; weaponSlots: {slotId: string; weaponId: string; weapon: Weapon; readyAt: number}[]; equipmentSlot: {slotId: string}; ai: AiModule }
export interface Battle { seed: number; tick: number; time: number; ships: Ship[]; intel: Record<Team, Record<string, number>>; events: string[]; result: Team | 'draw' | null; random: () => number }
export const STEP = 1
/** Legacy battle consumes the same character catalog as dogfight. */
export const profiles = characters.map((_, index) => resolveCharacter(index))
export function createBattle(seed: number, blue: number[] = [0, 1, 2], red: number[] = [0, 1, 2]): Battle {
  for (const lineup of [blue, red]) {
    if (lineup.length < 1 || lineup.length > 6 || lineup.some(i => !Number.isInteger(i) || !profiles[i])) throw new Error('each fleet must contain 1 to 6 valid profiles')
  }
  const ships: Ship[] = (['blue', 'red'] as Team[]).flatMap(team => (team === 'blue' ? blue : red).map((index, i) => {
    const p = resolveCharacter(index)
    const column = Math.floor(i / 3), row = i % 3
    return { ...p, id: `${team}-${i}`, team, x: team === 'blue' ? 15 + column * 10 : 105 - column * 10, y: 25 + row * 25, hp: p.stats.hp }
  }))
  return { seed, tick: 0, time: 0, ships, intel: { blue: {}, red: {} }, events: [], result: null, random: createRandom(seed) }
}
const distance = (a: Ship, b: Ship) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
export function stepBattle(b: Battle): Battle {
  if (b.result) return b
  const alive = b.ships.filter(s => s.hp > 0)
  const events: string[] = []
  // Compute both teams' observations and intents from the same pre-step snapshot.
  const nextIntel: Battle['intel'] = { blue: { ...b.intel.blue }, red: { ...b.intel.red } }
  for (const team of ['blue', 'red'] as Team[]) for (const target of alive.filter(s => s.team !== team)) {
    const sensors = alive.filter(s => s.team === team).map(s => s.stats.sen / (1 + (distance(s, target) / 60) ** 2)).sort((a, c) => c - a)
    const strength = (sensors[0] ?? 0) + 0.3 * sensors.slice(1).reduce((a, c) => a + c, 0)
    const previous = nextIntel[team][target.id] ?? 0
    const current = clamp(previous + 8 * 2 * strength / (strength + target.stats.stl), 0, 100)
    nextIntel[team][target.id] = current
    if (previous < 40 && current >= 40) events.push(`${team === 'blue' ? '蓝方' : '红方'}发现 ${target.name}`)
    if (previous < 100 && current >= 100) events.push(`${team === 'blue' ? '蓝方' : '红方'}锁定 ${target.name}`)
  }
  const moves = new Map<string, [number, number]>()
  const attacks: { attacker: Ship; target: Ship; intel: number }[] = []
  for (const ship of alive) {
    const targets = alive.filter(t => t.team !== ship.team && (nextIntel[ship.team][t.id] ?? 0) >= 40).sort ( (a, c) => distance(ship, a) - distance(ship, c) || a.id.localeCompare(c.id))
    // Search toward the opposing starting side without reading hidden enemy coordinates.
    const target = targets[0]
    const dx = target ? target.x - ship.x : ship.team === 'blue' ? 1 : -1
    const dy = target ? target.y - ship.y : 0
    const d = target ? distance(ship, target) : 1
    let dir = d > ship.preferredRange ? 1 : ship.personality === 'kite' && d < ship.preferredRange * 0.8 ? -1 : 0
    if (!target) dir = 1
    moves.set(ship.id, [clamp(ship.x + dir * ship.speed * dx / (d || 1), 0, 120), clamp(ship.y + dir * ship.speed * dy / (d || 1), 0, 100)])
    if (target && d <= ship.weaponSlots[0].weapon.range && b.time >= ship.weaponSlots[0].readyAt) attacks.push({ attacker: ship, target, intel: nextIntel[ship.team][target.id] })
  }
  const damage = new Map<string, number>()
  const cooldowns = new Map<string, number>()
  for (const { attacker, target, intel } of attacks.sort((a, c) => a.attacker.id.localeCompare(c.attacker.id))) {
    const chance = clamp(attacker.weaponSlots[0].weapon.accuracy * 2 * attacker.stats.acc / (attacker.stats.acc + target.stats.eva) * (intel >= 100 ? 1 : 0.6), 0.05, 0.95)
    cooldowns.set(attacker.id, b.time + attacker.weaponSlots[0].weapon.cooldown)
    if (b.random() >= chance) { events.push(`${attacker.name} → ${target.name}：${attacker.weaponSlots[0].weapon.id}未命中`); continue }
    const amount = attacker.stats.pwr * attacker.weaponSlots[0].weapon.power * 100 / (100 + target.stats.def * target.armor[attacker.weaponSlots[0].weapon.damage])
    damage.set(target.id, (damage.get(target.id) ?? 0) + amount)
    events.push(`${attacker.name} → ${target.name}：${attacker.weaponSlots[0].weapon.id}命中 ${amount.toFixed(1)}`)
  }
  const ships = b.ships.map(s => { const [x, y] = moves.get(s.id) ?? [s.x, s.y]; const hp = Math.max(0, s.hp - (damage.get(s.id) ?? 0)); if (s.hp > 0 && hp === 0) events.push(`${s.team === 'blue' ? '蓝方' : '红方'} ${s.name}退出战斗`); return { ...s, x, y, hp, weaponSlots: s.weaponSlots.map((slot,i) => i === 0 ? {...slot,readyAt:cooldowns.get(s.id) ?? slot.readyAt} : slot) } })
  const blue = ships.some(s => s.team === 'blue' && s.hp > 0), red = ships.some(s => s.team === 'red' && s.hp > 0)
  const time = b.time + STEP
  const result = !blue && !red ? 'draw' : !blue ? 'red' : !red ? 'blue' : time >= 180 ? 'draw' : null
  return { ...b, ships, intel: nextIntel, tick: b.tick + 1, time, result, events: [...b.events, ...events.map(e => `${time}s ${e}`)].slice(-120) }
}
