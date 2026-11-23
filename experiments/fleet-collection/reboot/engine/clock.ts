import { MAX_STEPS_PER_FRAME, SIM_STEP } from '../flight-config'

export { SIM_STEP }

export interface Clock {
  pending: number
  time: number
}

export function createClock(): Clock {
  return { pending: 0, time: 0 }
}

/**
 * Real seconds accumulate here. Each full step is one simulation tick.
 * A stalled frame cannot run away with more than a few steps.
 */
export function advance(
  clock: Clock,
  seconds: number,
): { clock: Clock; steps: number; alpha: number } {
  let pending = clock.pending + (Number.isFinite(seconds) && seconds > 0 ? seconds : 0)
  let steps = 0
  let time = clock.time
  while (pending >= SIM_STEP && steps < MAX_STEPS_PER_FRAME) {
    pending -= SIM_STEP
    time = Number((time + SIM_STEP).toFixed(10))
    steps++
  }
  if (steps === MAX_STEPS_PER_FRAME) pending = Math.min(pending, SIM_STEP)
  return { clock: { pending, time }, steps, alpha: pending / SIM_STEP }
}
