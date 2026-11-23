import type { AiCondition, AiTactic, StateNode, Strategy, StrategyBase } from '../types'

type PriorityBranch = { when: readonly AiCondition[]; tactic: AiTactic }

/** Priority list: the first matching branch wins, same as a hierarchical state machine. */
function tree(id: string, branches: readonly PriorityBranch[]): { root: string; states: StateNode[] } {
  const root = `${id}-root`
  return {
    root,
    states: [
      { id: root, tactic: 'search', branches: branches.map((branch, index) => ({ when: [...branch.when], to: `${id}-${index}` })) },
      ...branches.map((branch, index) => ({ id: `${id}-${index}`, tactic: branch.tactic, branches: [] })),
    ],
  }
}
function strategy(id: string, name: string, shipClass: Strategy['shipClass'], base: StrategyBase, branches: readonly PriorityBranch[]): Strategy {
  return { id, name, shipClass, base, ...tree(id, branches) }
}

const close = [
  { when: ['noTarget'], tactic: 'search' },
  { when: ['tooClose'], tactic: 'evade' },
  { when: ['cooling', 'cover'], tactic: 'cover' },
  { when: ['hasTarget'], tactic: 'attack' },
] as const

const hold = [
  { when: ['noTarget'], tactic: 'search' },
  { when: ['tooClose'], tactic: 'evade' },
  { when: ['incoming'], tactic: 'evade' },
  { when: ['cooling', 'cover'], tactic: 'cover' },
  { when: ['inBand', 'open'], tactic: 'attack' },
  { when: ['hasTarget'], tactic: 'approach' },
] as const

export const strategies: Record<string, Strategy> = {
  'destroyer-raid': strategy('destroyer-raid', '突进侦察', 'destroyer', { preferredRange: 24, orbitStrength: .9, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2, useCover: true, disengageRatio: .62, engageRatio: 1 }, [...close]),
  'destroyer-screen': strategy('destroyer-screen', '屏卫牵制', 'destroyer', { preferredRange: 32, orbitStrength: 1, dodgeStrength: 2.2, turnRate: .85, turnAcceleration: 1.3, useCover: true, disengageRatio: .72, engageRatio: 1.05 }, [...hold]),
  'cruiser-escort': strategy('cruiser-escort', '中距护卫', 'cruiser', { preferredRange: 35, orbitStrength: .9, dodgeStrength: 1.8, turnRate: .75, turnAcceleration: 1.1, useCover: true, disengageRatio: .7, engageRatio: 1 }, [...hold]),
  'cruiser-flank': strategy('cruiser-flank', '侧翼压迫', 'cruiser', { preferredRange: 28, orbitStrength: 1.05, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2, useCover: true, disengageRatio: .58, engageRatio: 1.05 }, [...close]),
  'battleship-artillery': strategy('battleship-artillery', '远距炮击', 'battleship', { preferredRange: 46, orbitStrength: .85, dodgeStrength: 1.4, turnRate: .7, turnAcceleration: 1, useCover: true, disengageRatio: .75, engageRatio: 1.05 }, [...hold]),
  'battleship-push': strategy('battleship-push', '推进炮击', 'battleship', { preferredRange: 36, orbitStrength: .9, dodgeStrength: 1.5, turnRate: .7, turnAcceleration: 1, useCover: true, disengageRatio: .6, engageRatio: 1 }, [...close]),
  'carrier-standoff': strategy('carrier-standoff', '远端放飞', 'carrier', { preferredRange: 72, orbitStrength: .8, dodgeStrength: 1.6, turnRate: .75, turnAcceleration: 1.1, useCover: true, disengageRatio: .7, engageRatio: 1.1 }, [
    { when: ['noTarget'], tactic: 'search' },
    { when: ['tooClose'], tactic: 'evade' },
    { when: ['incoming'], tactic: 'evade' },
    { when: ['hasTarget'], tactic: 'attack' },
  ]),
  'carrier-mobile': strategy('carrier-mobile', '机动放飞', 'carrier', { preferredRange: 54, orbitStrength: 1, dodgeStrength: 2.1, turnRate: .85, turnAcceleration: 1.3, useCover: false, disengageRatio: .6, engageRatio: 1.1 }, [
    { when: ['noTarget'], tactic: 'search' },
    { when: ['tooClose'], tactic: 'evade' },
    { when: ['hasTarget'], tactic: 'attack' },
  ]),
  'submarine-ambush': strategy('submarine-ambush', '伏击', 'submarine', { preferredRange: 26, orbitStrength: .7, dodgeStrength: 1.6, turnRate: .75, turnAcceleration: 1.1, useCover: true, disengageRatio: .7, engageRatio: .95 }, [...hold]),
  'submarine-hunt': strategy('submarine-hunt', '追击', 'submarine', { preferredRange: 20, orbitStrength: .85, dodgeStrength: 1.8, turnRate: .8, turnAcceleration: 1.2, useCover: true, disengageRatio: .55, engageRatio: 1.05 }, [...close]),
  'aircraft-strike': strategy('aircraft-strike', '突击', 'aircraft', { preferredRange: 22, orbitStrength: 1.15, dodgeStrength: 2.5, turnRate: 1.1, turnAcceleration: 1.6, useCover: false, disengageRatio: .5, engageRatio: 1.1 }, [...close]),
}
