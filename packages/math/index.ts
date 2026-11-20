/** Curves use x = 0 for the starting value. */
export type Curve =
  | { type: 'linear'; base: number; slope: number }
  | { type: 'exponential'; base: number; rate: number }
  | { type: 'power'; base: number; exponent: number }
  | { type: 'logistic'; min: number; max: number; midpoint: number; steepness: number }
  | { type: 'piecewise'; points: Array<[number, number]> }

export function evaluateCurve(curve: Curve, x: number): number {
  if (!Number.isFinite(x)) throw new Error('x must be finite')
  switch (curve.type) {
    case 'linear':
      return curve.base + curve.slope * x
    case 'exponential':
      return curve.base * curve.rate ** x
    case 'power':
      return curve.base * x ** curve.exponent
    case 'logistic':
      return (
        curve.min +
        (curve.max - curve.min) / (1 + Math.exp(-curve.steepness * (x - curve.midpoint)))
      )
    case 'piecewise': {
      const p = curve.points
      if (
        !p.length ||
        p.some(
          ([px, py], i) =>
            !Number.isFinite(px) || !Number.isFinite(py) || (i > 0 && px <= p[i - 1][0]),
        )
      )
        throw new Error('points must have finite values and strictly increasing x')
      if (x <= p[0][0]) return p[0][1]
      for (let i = 1; i < p.length; i++)
        if (x <= p[i][0]) {
          const [x0, y0] = p[i - 1],
            [x1, y1] = p[i]
          return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
        }
      return p[p.length - 1][1]
    }
  }
}
