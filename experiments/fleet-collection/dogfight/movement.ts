import type { Ship, Battle } from '../battle/model'
import type { Dogfight } from './model'
import type { TerrainBox } from './terrain'
import { decideIntents } from './ai/intent'
import { moveSystem } from './motion/move-system'

/** AI publishes intent headings, then the move system integrates hull heading and position. */
export function moveFleet(b: Dogfight, alive: Ship[], intel: Battle['intel'], obstacles: TerrainBox[], events: string[]) {
  const decision = decideIntents(b, alive, intel, obstacles, events)
  const headings = { ...b.headings }
  const turnRates = { ...b.turnRates }
  const stuck = { ...(b.stuck ?? {}) }
  const moved = new Map<string, Ship>()
  for (const ship of alive) {
    const intentHeading = decision.intents.headings[ship.id]
    const slotSide = Number(ship.id.split('-').at(-1)) % 2 === 0 ? 1 : -1
    const step = moveSystem({
      x: ship.x,
      y: ship.y,
      heading: headings[ship.id] ?? intentHeading,
      intentHeading,
      acceleration: ship.ai.turnAcceleration,
      speed: ship.speed * 3,
      turnRate: turnRates[ship.id] ?? 0,
      maxTurnRate: ship.ai.turnRate,
      stuckSince: stuck[ship.id],
    }, { obstacles, time: b.time, side: decision.bypass[ship.id] ?? slotSide })
    headings[ship.id] = step.heading
    turnRates[ship.id] = step.turnRate
    if (step.stuckSince === undefined) delete stuck[ship.id]
    else stuck[ship.id] = step.stuckSince
    if (step.pushed) {
      events.push(`${ship.team === 'blue' ? '蓝' : '红'}方 ${ship.name}脱离楼体`)
      delete decision.navigation[ship.id]
      delete decision.cover[ship.id]
    }
    moved.set(ship.id, { ...ship, x: step.x, y: step.y })
  }
  return { moved, headings, turnRates, intentHeadings: decision.intents.headings, navigation: decision.navigation, cover: decision.cover, tactics: decision.tactics, orbits: decision.orbits, targets: decision.targets, stuck, bypass: decision.bypass }
}
