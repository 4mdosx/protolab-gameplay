import type { Hull, Shot } from './types'
import { GUN_RANGE, bearing, inArc } from './arc'

const COOLDOWN = 1.2
const SHOT_SPEED = 45
const HIT_RADIUS = 4
const DAMAGE = 8

export function tryFire(hull: Hull, target: Hull, nextShot: number): { hull: Hull; shot?: Shot; nextShot: number } {
  if (hull.cooldown > 0 || hull.hp <= 0 || target.hp <= 0 || !inArc(hull, target)) return { hull, nextShot }
  const aim = bearing(hull, target)
  return {
    hull: { ...hull, cooldown: COOLDOWN },
    nextShot: nextShot + 1,
    shot: { id: nextShot, team: hull.team, x: hull.x, y: hull.y, vx: Math.cos(aim) * SHOT_SPEED, vy: Math.sin(aim) * SHOT_SPEED, life: GUN_RANGE / SHOT_SPEED },
  }
}

export function flyShots(shots: Shot[], hulls: Hull[], dt: number): { shots: Shot[]; hulls: Hull[]; hits: string[] } {
  const hits: string[] = []
  const nextHulls = hulls.map(hull => ({ ...hull, cooldown: Math.max(0, hull.cooldown - dt) }))
  const nextShots: Shot[] = []
  for (const shot of shots) {
    const x = shot.x + shot.vx * dt
    const y = shot.y + shot.vy * dt
    const life = shot.life - dt
    const hit = nextHulls.find(hull => hull.team !== shot.team && hull.hp > 0 && Math.hypot(hull.x - x, hull.y - y) <= HIT_RADIUS)
    if (hit) {
      hit.hp = Math.max(0, hit.hp - DAMAGE)
      hits.push(`${shot.team === 'blue' ? '蓝' : '红'}方命中 ${hit.name} ${DAMAGE}`)
      continue
    }
    if (life > 0) nextShots.push({ ...shot, x, y, life })
  }
  return { shots: nextShots, hulls: nextHulls, hits }
}
