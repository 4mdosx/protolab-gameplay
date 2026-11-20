/** Deterministic Mulberry32 generator; seed is converted to an unsigned 32-bit integer. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export interface SimulationContext {
  random: () => number
  tick: number
  delta: number
}
export interface GameExperiment<S, A, C> {
  id: string
  initialState(config: C): S
  step(state: S, action: A, context: SimulationContext): S
  metrics(state: S): Record<string, number>
}
export function run<S, A, C>(
  experiment: GameExperiment<S, A, C>,
  config: C,
  seed: number,
  ticks: number,
  delta: number,
  action: (state: S, tick: number) => A,
): S {
  if (!Number.isInteger(ticks) || ticks < 0 || !Number.isFinite(delta) || delta <= 0)
    throw new Error('invalid simulation duration')
  const random = createRandom(seed)
  let state = experiment.initialState(config)
  for (let tick = 0; tick < ticks; tick++)
    state = experiment.step(state, action(state, tick), { random, tick, delta })
  return state
}
export function summarize(values: number[]) {
  if (!values.length || values.some((v) => !Number.isFinite(v)))
    throw new Error('expected finite values')
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median:
      (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
  }
}
export function batch<S, A, C>(
  experiment: GameExperiment<S, A, C>,
  config: C,
  seeds: number[],
  ticks: number,
  delta: number,
  action: (state: S, tick: number) => A,
) {
  return seeds.map((seed) => ({
    seed,
    metrics: experiment.metrics(run(experiment, config, seed, ticks, delta, action)),
  }))
}
