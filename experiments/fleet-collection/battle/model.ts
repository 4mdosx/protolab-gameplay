import { createRandom } from '../../../packages/simulation'

export type Team = 'blue' | 'red'
export type Personality = 'advance' | 'kite'
export type DamageType = 'kinetic' | 'underwater'
export type Layer = 'surface' | 'air' | 'submerged'
export type ShipClass = 'destroyer' | 'cruiser' | 'battleship' | 'aircraft' | 'submarine'
export interface Stats { hp: number; pwr: number; def: number; acc: number; eva: number; sen: number; stl: number }
export interface Weapon { id: string; delivery: 'ballistic' | 'torpedo'; damage: DamageType; range: number; cooldown: number; power: number; accuracy: number }
export interface Ship { shipClass: ShipClass; layer: Layer; id: string; name: string; team: Team; x: number; y: number; speed: number; preferredRange: number; personality: Personality; stats: Stats; hp: number; armor: Record<DamageType, number>; weapon: Weapon; readyAt: number }
export interface Battle { seed: number; tick: number; time: number; ships: Ship[]; intel: Record<Team, Record<string, number>>; events: string[]; result: Team | 'draw' | null; random: () => number }
export const STEP = 1
const gun: Weapon = { id: '主炮', delivery: 'ballistic', damage: 'kinetic', range: 52, cooldown: 4, power: 0.46, accuracy: 0.85 }
const torpedo: Weapon = { id: '鱼雷', delivery: 'torpedo', damage: 'underwater', range: 30, cooldown: 7, power: 0.75, accuracy: 0.7 }
export const profiles = [
  { shipClass: 'destroyer' as const, layer: 'surface' as const, name: '侦察驱逐', speed: 5, preferredRange: 24, personality: 'advance' as const, stats: { hp: 72, pwr: 28, def: 22, acc: 45, eva: 62, sen: 85, stl: 55 }, armor: { kinetic: 0.8, underwater: 1.2 }, weapon: torpedo },
  { shipClass: 'cruiser' as const, layer: 'surface' as const, name: '护卫巡洋', speed: 3, preferredRange: 35, personality: 'advance' as const, stats: { hp: 105, pwr: 42, def: 48, acc: 55, eva: 38, sen: 58, stl: 30 }, armor: { kinetic: 1, underwater: 1 }, weapon: gun },
  { shipClass: 'battleship' as const, layer: 'surface' as const, name: '炮击战列', speed: 2, preferredRange: 44, personality: 'kite' as const, stats: { hp: 155, pwr: 65, def: 75, acc: 60, eva: 20, sen: 38, stl: 20 }, armor: { kinetic: 1.4, underwater: 0.7 }, weapon: gun },
  { shipClass: 'aircraft' as const, layer: 'air' as const, name: '航空单位', speed: 5, preferredRange: 30, personality: 'advance' as const, stats: { hp: 60, pwr: 32, def: 18, acc: 50, eva: 65, sen: 70, stl: 35 }, armor: { kinetic: 0.8, underwater: 1.2 }, weapon: gun },
  { shipClass: 'submarine' as const, layer: 'submerged' as const, name: '潜航单位', speed: 3, preferredRange: 24, personality: 'advance' as const, stats: { hp: 80, pwr: 35, def: 30, acc: 45, eva: 40, sen: 40, stl: 80 }, armor: { kinetic: 0.8, underwater: 1.2 }, weapon: torpedo },
]
export function createBattle(seed: number, blue: number[] = [0, 1, 2], red: number[] = [0, 1, 2]): Battle {
  for (const lineup of [blue, red]) {
    if (lineup.length < 1 || lineup.length > 6 || lineup.some(i => !Number.isInteger(i) || !profiles[i])) throw new Error('each fleet must contain 1 to 6 valid profiles')
  }
  const ships: Ship[] = (['blue', 'red'] as Team[]).flatMap(team => (team === 'blue' ? blue : red).map((index, i) => {
    const p = profiles[index]
    const column = Math.floor(i / 3), row = i % 3
    return { ...p, id: `${team}-${i}`, team, x: team === 'blue' ? 15 + column * 10 : 105 - column * 10, y: 25 + row * 25, hp: p.stats.hp, readyAt: 0 }
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
    if (target && d <= ship.weapon.range && b.time >= ship.readyAt) attacks.push({ attacker: ship, target, intel: nextIntel[ship.team][target.id] })
  }
  const damage = new Map<string, number>()
  const cooldowns = new Map<string, number>()
  for (const { attacker, target, intel } of attacks.sort((a, c) => a.attacker.id.localeCompare(c.attacker.id))) {
    const chance = clamp(attacker.weapon.accuracy * 2 * attacker.stats.acc / (attacker.stats.acc + target.stats.eva) * (intel >= 100 ? 1 : 0.6), 0.05, 0.95)
    cooldowns.set(attacker.id, b.time + attacker.weapon.cooldown)
    if (b.random() >= chance) { events.push(`${attacker.name} → ${target.name}：${attacker.weapon.id}未命中`); continue }
    const amount = attacker.stats.pwr * attacker.weapon.power * 100 / (100 + target.stats.def * target.armor[attacker.weapon.damage])
    damage.set(target.id, (damage.get(target.id) ?? 0) + amount)
    events.push(`${attacker.name} → ${target.name}：${attacker.weapon.id}命中 ${amount.toFixed(1)}`)
  }
  const ships = b.ships.map(s => { const [x, y] = moves.get(s.id) ?? [s.x, s.y]; const hp = Math.max(0, s.hp - (damage.get(s.id) ?? 0)); if (s.hp > 0 && hp === 0) events.push(`${s.team === 'blue' ? '蓝方' : '红方'} ${s.name}退出战斗`); return { ...s, x, y, hp, readyAt: cooldowns.get(s.id) ?? s.readyAt } })
  const blue = ships.some(s => s.team === 'blue' && s.hp > 0), red = ships.some(s => s.team === 'red' && s.hp > 0)
  const time = b.time + STEP
  const result = !blue && !red ? 'draw' : !blue ? 'red' : !red ? 'blue' : time >= 180 ? 'draw' : null
  return { ...b, ships, intel: nextIntel, tick: b.tick + 1, time, result, events: [...b.events, ...events.map(e => `${time}s ${e}`)].slice(-120) }
}
