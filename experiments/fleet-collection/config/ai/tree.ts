import { strategies } from './strategies'
import type { AiCondition, AiModule, AiTactic, ShipClass, StrategyMount } from '../types'

export interface AiSituation {
  hasTarget: boolean
  distance: number
  weaponReady: boolean
  blocked: boolean
  incoming: boolean
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function unit(name: string, value: number) {
  if (typeof value !== 'number' || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`)
}

/** Bind aggressiveness and initiative onto a strategy. The tree stays the same; the thresholds move. */
export function resolveStrategy(mount: StrategyMount, expected: ShipClass | 'aircraft'): AiModule {
  const strategy = strategies[mount.strategyId]
  if (!strategy) throw new Error(`unknown strategy: ${mount.strategyId}`)
  if (strategy.shipClass !== expected) throw new Error(`strategy ${strategy.id} does not fit ${expected}`)
  unit('aggressiveness', mount.aggressiveness)
  unit('initiative', mount.initiative)
  const ids = strategy.states.map(state => state.id)
  if (new Set(ids).size !== ids.length || !ids.includes(strategy.root)) throw new Error(`invalid state tree for ${strategy.id}`)
  for (const state of strategy.states) for (const branch of state.branches) {
    if (!branch.when.length || !ids.includes(branch.to)) throw new Error(`invalid transition in ${strategy.id}`)
  }
  const seen = new Set<string>()
  const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); strategy.states.find(state => state.id === id)?.branches.forEach(branch => visit(branch.to)) }
  visit(strategy.root)
  if (seen.size !== ids.length) throw new Error(`unreachable state in ${strategy.id}`)
  const { aggressiveness, initiative } = mount
  const disengageRatio = clamp(strategy.base.disengageRatio + (0.5 - aggressiveness) * 0.3, 0.35, 0.85)
  const engageRatio = clamp(strategy.base.engageRatio + (initiative - 0.5) * 0.35, disengageRatio + 0.05, 1.45)
  return {
    id: strategy.id,
    name: strategy.name,
    strategyId: strategy.id,
    aggressiveness,
    initiative,
    preferredRange: strategy.base.preferredRange * (1.18 - 0.4 * aggressiveness),
    orbitStrength: strategy.base.orbitStrength * (0.8 + initiative * 0.45),
    dodgeStrength: strategy.base.dodgeStrength * (0.75 + initiative * 0.6),
    turnRate: strategy.base.turnRate,
    turnAcceleration: strategy.base.turnAcceleration,
    useCover: strategy.base.useCover && aggressiveness < 0.8,
    disengageRatio,
    engageRatio,
    personality: aggressiveness < 0.45 ? 'kite' : 'advance',
    root: strategy.root,
    states: strategy.states.map(state => ({ ...state, branches: state.branches.map(branch => ({ to: branch.to, when: [...branch.when] })) })),
  }
}

function holds(condition: AiCondition, ai: AiModule, situation: AiSituation) {
  const band = ai.preferredRange
  switch (condition) {
    case 'noTarget': return !situation.hasTarget
    case 'hasTarget': return situation.hasTarget
    case 'tooClose': return situation.hasTarget && situation.distance < band * ai.disengageRatio
    case 'inBand': return situation.hasTarget && situation.distance >= band * ai.disengageRatio && situation.distance <= band * ai.engageRatio
    case 'outOfBand': return situation.hasTarget && situation.distance > band * ai.engageRatio
    case 'cooling': return situation.hasTarget && !situation.weaponReady
    case 'ready': return situation.hasTarget && situation.weaponReady
    case 'blocked': return situation.hasTarget && situation.blocked
    case 'open': return situation.hasTarget && !situation.blocked
    case 'incoming': return situation.incoming
    case 'cover': return ai.useCover
  }
}

/** Walk the strategy tree. The first matching branch wins, so declaration order is the priority. */
export function selectState(ai: AiModule, situation: AiSituation): AiTactic {
  let id = ai.root
  const seen = new Set<string>()
  for (let guard = 0; guard < 8; guard++) {
    if (seen.has(id)) break
    seen.add(id)
    const node = ai.states.find(state => state.id === id)
    if (!node) break
    const branch = node.branches.find(item => item.when.every(condition => holds(condition, ai, situation)))
    if (!branch) return node.tactic
    id = branch.to
  }
  return 'search'
}
