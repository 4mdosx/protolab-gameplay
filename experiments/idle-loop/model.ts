import { evaluateCurve, type Curve } from '../../packages/math'
import { upgradeCost } from '../../packages/progression'
import type { GameExperiment } from '../../packages/simulation'
export interface Config {
  cost: Curve
  income: Curve
  bonusChance: number
}
export interface State {
  level: number
  resources: number
  elapsed: number
  upgrades: number
  earned: number
}
export type Action = 'wait' | 'upgrade' | 'auto'
export const idle: GameExperiment<State, Action, Config> = {
  id: 'idle-loop',
  initialState: () => ({ level: 1, resources: 0, elapsed: 0, upgrades: 0, earned: 0 }),
  step(state, action, ctx) {
    const config = currentConfig.get(state)
    if (!config) throw new Error('state is not bound to configuration')
    const earned =
      evaluateCurve(config.income, state.level - 1) *
      ctx.delta *
      (ctx.random() < config.bonusChance ? 2 : 1)
    const next = {
      ...state,
      elapsed: state.elapsed + ctx.delta,
      resources: state.resources + earned,
      earned: state.earned + earned,
    }
    const cost = upgradeCost(config.cost, next.level)
    if (action !== 'wait' && next.resources >= cost) {
      next.resources -= cost
      next.level++
      next.upgrades++
    }
    currentConfig.set(next, config)
    return next
  },
  metrics: (s) => ({
    level: s.level,
    resources: s.resources,
    earned: s.earned,
    upgrades: s.upgrades,
    elapsed: s.elapsed,
  }),
}
// Each state carries its experiment configuration without modifying the serializable state.
const currentConfig = new WeakMap<State, Config>()
const initial = idle.initialState
idle.initialState = (config) => {
  const state = initial(config)
  currentConfig.set(state, config)
  return state
}
