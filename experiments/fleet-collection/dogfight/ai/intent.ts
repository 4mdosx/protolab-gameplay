import type { Ship, Battle } from '../../battle/model'
import type { Dogfight } from '../model'
import type { TerrainBox } from '../terrain'
import { boxEntry, terrainImpact } from '../terrain'
import { findPath } from '../pathfinding'
import { chooseCover, chooseFiringPosition } from '../cover'
import { canAttack } from '../combat'
import { selectState } from '../../config'
import { setMovementCommand, steerDestroyer, type Maneuver, type MovementCommand } from './steering'

const RADIUS = 2
const CLEARANCE = 4
const LOOK = 42
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const gap = (point: { x: number; y: number }, box: TerrainBox) => {
  const x = Math.max(box.x, Math.min(point.x, box.x + box.width))
  const y = Math.max(box.y, Math.min(point.y, box.y + box.height))
  return Math.hypot(point.x - x, point.y - y)
}
const surface = (boxes: TerrainBox[]) => boxes.filter(box => box.blocks.includes('surface'))
const minGap = (point: { x: number; y: number }, boxes: TerrainBox[]) => {
  const list = surface(boxes)
  return list.length ? Math.min(...list.map(box => gap(point, box))) : Infinity
}
function firstBlock(from: { x: number; y: number }, to: { x: number; y: number }, boxes: TerrainBox[]) {
  let best: TerrainBox | null = null, bestT = Infinity
  for (const box of surface(boxes)) {
    const t = boxEntry(from, to, box, CLEARANCE - 0.5)
    if (t !== null && t < bestT) { bestT = t; best = box }
  }
  return best
}
/** One side of the blocker, held until the way ahead is clear. The other side is used only when this side has no exit. */
function passPoint(from: { x: number; y: number }, box: TerrainBox, sign: number, aim: { x: number; y: number }, boxes: TerrainBox[]) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, ax = aim.x - from.x, ay = aim.y - from.y, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al, lx = -uy * sign, ly = ux * sign, margin = CLEARANCE + 2
  const candidates = [{ x: box.x - margin, y: cy }, { x: box.x + box.width + margin, y: cy }, { x: cx, y: box.y - margin }, { x: cx, y: box.y + box.height + margin }, { x: box.x - margin, y: box.y - margin }, { x: box.x + box.width + margin, y: box.y - margin }, { x: box.x - margin, y: box.y + box.height + margin }, { x: box.x + box.width + margin, y: box.y + box.height + margin }]
  const ranked = candidates.filter(p => {
    const vx = p.x - from.x, vy = p.y - from.y
    return vx * ux + vy * uy > -4 && terrainImpact(from, p, 'surface', boxes, RADIUS) === null && minGap(p, boxes) >= CLEARANCE - 0.05
  }).map(p => ({ p, align: (p.x - from.x) * lx + (p.y - from.y) * ly, score: distance(p, aim) }))
  ranked.sort((a, b) => b.align - a.align || a.score - b.score || a.p.x - b.p.x || a.p.y - b.p.y)
  return ranked[0]?.p ?? null
}
function steerAround(from: { x: number; y: number }, desired: number, aim: { x: number; y: number }, boxes: TerrainBox[], side: number, committed?: number) {
  const far = { x: from.x + Math.cos(desired) * LOOK, y: from.y + Math.sin(desired) * LOOK }
  const box = firstBlock(from, far, boxes)
  if (!box) return { heading: desired, sign: null as number | null }
  let sign = committed === 1 || committed === -1 ? committed : 0
  if (!sign) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2
    const cross = (aim.x - from.x) * (cy - from.y) - (aim.y - from.y) * (cx - from.x)
    sign = cross > 0.5 ? -1 : cross < -0.5 ? 1 : side
  }
  let pass = passPoint(from, box, sign, aim, boxes)
  if (!pass) {
    const other = passPoint(from, box, -sign, aim, boxes)
    if (other) { sign = -sign; pass = other }
  }
  return pass ? { heading: Math.atan2(pass.y - from.y, pass.x - from.x), sign } : { heading: desired, sign }
}

/** Intent the state tree is allowed to publish. Movement reads the heading and does not write it back. */
export interface IntentStore { headings: Record<string, number> }

/** The only write path for a unit's intent heading. */
export function setIntentHeading(store: IntentStore, id: string, heading: number) {
  if (!Number.isFinite(heading)) throw new Error(`invalid intent heading for ${id}`)
  store.headings[id] = Math.atan2(Math.sin(heading), Math.cos(heading))
}

export interface IntentDecision {
  intents: IntentStore
  commands: Record<string, MovementCommand>
  navigation: Dogfight['navigation']
  cover: Dogfight['cover']
  tactics: Dogfight['tactics']
  orbits: Dogfight['orbits']
  targets: Record<string, string>
  bypass: Record<string, number>
  maneuvers: Record<string, Maneuver>
  maneuverUntil: Record<string, number>
}

/** Walk each strategy tree, then publish one intent heading per unit. */
export function decideIntents(b: Dogfight, alive: Ship[], intel: Battle['intel'], obstacles: TerrainBox[], events: string[]): IntentDecision {
  const intents: IntentStore = { headings: {} }
  const commands: Record<string, MovementCommand> = {}
  const maneuvers = { ...(b.maneuvers ?? {}) }
  const maneuverUntil = { ...(b.maneuverUntil ?? {}) }
  const navigation = { ...b.navigation }
  const cover = { ...b.cover }
  const tactics = { ...b.tactics }
  const orbits: Dogfight['orbits'] = {}
  const targets: Record<string, string> = {}
  const bypass = { ...(b.bypass ?? {}) }
  for (const ship of alive) {
    const hullTarget = ship.shipClass === 'carrier' && !ship.unitKind
    const candidates = alive.filter(t => t.team !== ship.team && !t.unitKind && (hullTarget || ship.weaponSlots.some(slot => canAttack(ship, t, slot.weapon))) && (intel[ship.team][t.id] ?? 0) >= 40).sort((a, c) => distance(ship, a) - distance(ship, c) || a.id.localeCompare(c.id))
    const target = candidates[0]
    const dx = target ? target.x - ship.x : ship.team === 'blue' ? 1 : -1
    const dy = target ? target.y - ship.y : 0
    const d = target ? distance(ship, target) : 1
    const ux = dx / (d || 1), uy = dy / (d || 1), side = Number(ship.id.split('-').at(-1)) % 2 === 0 ? 1 : -1
    const threat = b.projectiles.filter(p => p.team !== ship.team).map(p => {
      const rx = ship.x - p.x, ry = ship.y - p.y, vv = p.vx * p.vx + p.vy * p.vy
      const t = clamp((rx * p.vx + ry * p.vy) / (vv || 1), 0, 0.8)
      return { p, t, miss: Math.hypot(rx - p.vx * t, ry - p.vy * t) }
    }).filter(x => x.miss < 5 && x.t > 0).sort((a, c) => a.t - c.t)[0]
    const blockedView = !!target && terrainImpact(ship, target, 'surface', obstacles) !== null
    const tactic = selectState(ship.ai, { hasTarget: !!target, distance: d, weaponReady: b.time + 1e-9 >= ship.weaponSlots[0].readyAt, blocked: blockedView, incoming: !!threat })
    const tooClose = tactic === 'evade'
    const awayX = d < 0.001 ? (ship.team === 'blue' ? -1 : 1) : -ux
    const awayY = d < 0.001 ? 0 : -uy
    const forward = !target ? (ship.shipClass === 'carrier' && !ship.unitKind ? 0 : 1) : tactic === 'approach' || (tactic === 'attack' && d > ship.ai.preferredRange) ? 0.8 : 0
    let vx = tooClose ? awayX * 2 - uy * side * 0.35 : ux * forward - uy * side * ship.ai.orbitStrength
    let vy = tooClose ? awayY * 2 + ux * side * 0.35 : uy * forward + ux * side * ship.ai.orbitStrength
    if (threat && !tooClose) {
      const speed = Math.hypot(threat.p.vx, threat.p.vy) || 1
      const cross = threat.p.vx * (ship.y - threat.p.y) - threat.p.vy * (ship.x - threat.p.x)
      const sign = cross >= 0 ? 1 : -1
      vx += -threat.p.vy / speed * sign * ship.ai.dodgeStrength
      vy += threat.p.vx / speed * sign * ship.ai.dodgeStrength
    }
    const cached = navigation[ship.id]
    const nose = b.headings[ship.id] ?? Math.atan2(vy, vx)
    const nearTerrain = terrainImpact(ship, { x: ship.x + Math.cos(nose) * 20, y: ship.y + Math.sin(nose) * 20 }, 'surface', obstacles, 4) !== null
    if (target && (ship.shipClass !== 'carrier' || !!ship.unitKind) && (nearTerrain || (cached?.waypoint && b.time < cached.nextCheck))) {
      let plan = cached
      if (!plan || plan.targetId !== target.id || b.time >= plan.nextCheck || (plan.waypoint && distance(ship, plan.waypoint) < 5)) {
        const path = findPath(ship, target, 'surface', obstacles)
        let waypoint = path?.[0] ?? null
        if (path) for (const candidate of path) { if (terrainImpact(ship, candidate, 'surface', obstacles, 4) !== null) break; waypoint = candidate }
        plan = { targetId: target.id, nextCheck: b.time + 2, waypoint }
        navigation[ship.id] = plan
      }
      if (plan.waypoint) { vx = plan.waypoint.x - ship.x; vy = plan.waypoint.y - ship.y }
    } else if (cached && (!target || b.time >= cached.nextCheck)) delete navigation[ship.id]
    if (tactics[ship.id] !== tactic) {
      tactics[ship.id] = tactic
      const label = { approach: '接敌', attack: '就绪：寻找射击路线', cover: '冷却：寻找掩体', evade: '脱离' } as const
      if (tactic in label) events.push(`${ship.team === 'blue' ? '蓝' : '红'}方 ${ship.name} ${label[tactic as keyof typeof label]}`)
      delete cover[ship.id]
    }
    if (target) { targets[ship.id] = target.id; orbits[ship.id] = { x: target.x, y: target.y, kind: 'enemy' } }
    if (target && !tooClose && (ship.shipClass !== 'carrier' || !!ship.unitKind)) {
      const needGoal = (tactic === 'cover' && ship.ai.useCover) || ((tactic === 'attack' || tactic === 'approach') && (blockedView || d > ship.weaponSlots[0].weapon.range))
      let plan = cover[ship.id]
      if (needGoal && (!plan || plan.targetId !== target.id || b.time >= plan.retryAt)) {
        const coverFound = tactic === 'cover' ? chooseCover(ship, target, 'surface', obstacles) : null
        const found = coverFound ?? (tactic === 'attack' ? chooseFiringPosition(ship, target, 'surface', ship.weaponSlots[0].weapon.range, obstacles) : null)
        plan = { targetId: target.id, goal: found?.goal ?? null, waypoint: found?.waypoint ?? null, replanAt: b.time + 1, until: Infinity, retryAt: b.time + 2, anchor: coverFound?.anchor, radius: coverFound?.radius }
        cover[ship.id] = plan
      }
      if (needGoal && plan?.goal) {
        if (tactic === 'cover' && plan.anchor && distance(ship, plan.goal) < Math.max(12, (plan.radius ?? 15))) {
          const ox = ship.x - plan.anchor.x, oy = ship.y - plan.anchor.y, od = Math.hypot(ox, oy) || 1
          const radial = clamp(((plan.radius ?? 15) - od) * 0.12, -0.8, 0.8)
          vx = -oy / od * side + ox / od * radial
          vy = ox / od * side + oy / od * radial
          orbits[ship.id] = { ...plan.anchor, kind: 'building' }
        } else {
          if (b.time >= plan.replanAt || (plan.waypoint && distance(ship, plan.waypoint) < 4)) {
            const path = findPath(ship, plan.goal, 'surface', obstacles, 400)
            let waypoint = path?.[0] ?? null
            if (path) for (const candidate of path) { if (terrainImpact(ship, candidate, 'surface', obstacles, 4) !== null) break; waypoint = candidate }
            plan = { ...plan, waypoint, replanAt: b.time + 1 }
            cover[ship.id] = plan
          }
          if (plan.waypoint) { vx = plan.waypoint.x - ship.x; vy = plan.waypoint.y - ship.y }
        }
      }
    }
    const aim = cover[ship.id]?.waypoint ?? navigation[ship.id]?.waypoint ?? (target ? { x: target.x, y: target.y } : { x: ship.x + vx, y: ship.y + vy })
    const around = orbits[ship.id]?.kind === 'building' ? { heading: Math.atan2(vy, vx), sign: null as number | null } : steerAround(ship, Math.atan2(vy, vx), aim, obstacles, side, bypass[ship.id])
    if (around.sign) bypass[ship.id] = around.sign
    else delete bypass[ship.id]
    if (ship.shipClass === 'destroyer' && !ship.unitKind) {
      const cruise = ship.speed * 3
      const inRange = !!target && d <= ship.weaponSlots[0].weapon.range
      const held = (maneuverUntil[ship.id] ?? 0) > b.time && tactic === 'attack'
      const command = steerDestroyer({ cruise, tactic, aggression: ship.ai.aggressiveness, preferred: ship.ai.preferredRange, distance: d, ux, uy, travelHeading: around.heading, blocked: blockedView, inRange, buildingOrbit: orbits[ship.id]?.kind === 'building', side, previous: maneuvers[ship.id], held })
      if (maneuvers[ship.id] !== command.maneuver || (maneuverUntil[ship.id] ?? 0) <= b.time) maneuverUntil[ship.id] = b.time + 0.8
      maneuvers[ship.id] = command.maneuver
      setMovementCommand(commands, ship.id, command)
      setIntentHeading(intents, ship.id, command.desiredFacing)
    } else setIntentHeading(intents, ship.id, around.heading)
  }
  return { intents, commands, navigation, cover, tactics, orbits, targets, bypass, maneuvers, maneuverUntil }
}
