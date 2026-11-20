import { evaluateCurve, type Curve } from '../math'
/** Levels start at 1; curve x = 0 is the first upgrade. */
export function upgradeCost(curve: Curve, level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error('level must be a positive integer')
  return Math.max(0, evaluateCurve(curve, level - 1))
}
