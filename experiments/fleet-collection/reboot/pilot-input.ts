import type { Input } from './components'

export type PilotAction =
  | 'stepUp' | 'stepLeft' | 'stepDown' | 'stepRight' | 'brake' | 'boost'
  | 'toggleHeadingHold' | 'toggleGear' | 'recenter' | 'fire' | 'toggleTarget'
  | 'selectPrimary' | 'selectSecondary' | 'clearWeapon'

interface CommandContext {
  target?: number
  recenterHeading?: number
}

/** Persistent held intentions and one-shot requests for the next simulation tick. */
export function createPilotInput(input: Input) {
  const held = new Set<PilotAction>()

  function updateHeldControls() {
    input.brake = held.has('brake')
    input.boostHeld = held.has('boost')
  }

  return {
    press(action: PilotAction, context: CommandContext = {}) {
      switch (action) {
        case 'brake':
        case 'boost':
          if (action === 'boost' && !held.has(action)) input.boostPressed = true
          held.add(action)
          updateHeldControls()
          break
        case 'toggleHeadingHold':
          input.headingHold = !input.headingHold
          break
        case 'toggleGear':
          input.throttle = input.throttle === 1 ? 2 : 1
          break
        case 'toggleTarget':
          input.lockTarget = context.target === input.lockTarget ? undefined : context.target
          break
        case 'recenter':
          if (context.recenterHeading !== undefined) input.recenterHeading = context.recenterHeading
          break
        case 'stepUp':
          input.stepDirection = 'up'
          break
        case 'stepLeft':
          input.stepDirection = 'left'
          break
        case 'stepDown':
          input.stepDirection = 'down'
          break
        case 'stepRight':
          input.stepDirection = 'right'
          break
        case 'fire': {
          const queue = input.fireQueue ??= []
          queue.push(input.selectedGun ?? 0)
          break
        }
        case 'selectPrimary':
          input.selectedGun = input.selectedGun === 1 ? 0 : 1
          break
        case 'selectSecondary':
          input.selectedGun = input.selectedGun === 2 ? 0 : 2
          break
        case 'clearWeapon':
          input.selectedGun = 0
          break
      }
    },
    release(action: PilotAction) {
      if (held.delete(action)) updateHeldControls()
    },
    reset() {
      held.clear()
      updateHeldControls()
      input.boostPressed = false
      input.stepDirection = undefined
      input.recenterHeading = undefined
      input.fireQueue = []
    },
  }
}
