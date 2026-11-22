import type { Duel, Hull } from './types'
import { DT } from './types'
import { commandFor } from './pilot'
import { moveHull } from './move'
import { flyShots, tryFire } from './fire'

function hull(id: string, team: Hull['team'], x: number, heading: number): Hull {
  return { id, team, name: '晴岚', x, y: 0, heading, turnRate: 0, velocity: { x: 0, y: 0 }, hp: 72, cooldown: 0 }
}

export function createDuel(): Duel {
  return { time: 0, hulls: [hull('blue', 'blue', -40, 0), hull('red', 'red', 40, Math.PI)], shots: [], nextShot: 1, log: [] }
}

/** One fixed step: each ship asks for a command, moves, then may fire. Shots move last. */
export function stepDuel(duel: Duel): Duel {
  if (duel.hulls.filter(ship => ship.hp > 0).length < 2) return duel
  const moved = duel.hulls.map(ship => {
    const other = duel.hulls.find(candidate => candidate.id !== ship.id)!
    return ship.hp > 0 ? moveHull(ship, commandFor(ship, other), DT) : ship
  })
  const spawned = [...duel.shots]
  let nextShot = duel.nextShot
  const notes: string[] = []
  const afterFire: Hull[] = []
  for (const ship of moved) {
    const other = moved.find(candidate => candidate.id !== ship.id)!
    const fired = tryFire(ship, other, nextShot)
    nextShot = fired.nextShot
    if (fired.shot) {
      spawned.push(fired.shot)
      notes.push(`${ship.team === 'blue' ? '蓝' : '红'}方 ${ship.name} 开火`)
    }
    afterFire.push(fired.hull)
  }
  const flown = flyShots(spawned, afterFire, DT)
  const time = Math.round((duel.time + DT) * 10) / 10
  const log = [...duel.log, ...[...notes, ...flown.hits].map(line => `${time.toFixed(1)}s ${line}`)].slice(-40)
  return { time, hulls: flown.hulls, shots: flown.shots, nextShot, log }
}
