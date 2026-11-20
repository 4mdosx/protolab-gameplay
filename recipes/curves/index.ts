import type { Curve } from '../../packages/math'
export const starterUpgradeCost: Curve = { type: 'exponential', base: 10, rate: 1.35 }
export const starterIncome: Curve = { type: 'linear', base: 1, slope: 0.75 }
