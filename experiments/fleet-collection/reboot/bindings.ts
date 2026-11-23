import type { PilotAction } from './pilot-input'

interface Binding {
  action: PilotAction
  label: string
  keys?: readonly string[]
  mouseButton?: number
  held?: boolean
}

export const DEFAULT_BINDINGS: readonly Binding[] = [
  { action: 'toggleHeadingHold', label: 'C', keys: ['KeyC'] },
  { action: 'stepUp', label: 'W', keys: ['KeyW'] },
  { action: 'stepLeft', label: 'A', keys: ['KeyA'] },
  { action: 'stepDown', label: 'S', keys: ['KeyS'] },
  { action: 'stepRight', label: 'D', keys: ['KeyD'] },
  { action: 'brake', label: 'E', keys: ['KeyE'], held: true },
  { action: 'toggleGear', label: 'Shift', keys: ['ShiftLeft', 'ShiftRight'] },
  { action: 'boost', label: 'Q', keys: ['KeyQ'], held: true },
  { action: 'toggleTarget', label: 'F', keys: ['KeyF'] },
  { action: 'recenter', label: '鼠标左键', mouseButton: 0 },
  { action: 'fire', label: '空格', keys: ['Space'] },
  { action: 'selectPrimary', label: '1', keys: ['Digit1'] },
  { action: 'selectSecondary', label: '2', keys: ['Digit2'] },
  { action: 'clearWeapon', label: 'Esc', keys: ['Escape'] },
]

export function bindingLabel(action: PilotAction) {
  return DEFAULT_BINDINGS.find(binding => binding.action === action)!.label
}

export function createBindings(
  press: (action: PilotAction) => void,
  release: (action: PilotAction) => void,
  bindings: readonly Binding[] = DEFAULT_BINDINGS,
) {
  const down = new Set<string>()
  return {
    keyDown(code: string, repeated: boolean) {
      const binding = bindings.find(candidate => candidate.keys?.includes(code))
      if (!binding) return false
      if (repeated || down.has(code)) return true
      const alreadyHeld = binding.keys?.some(key => down.has(key))
      down.add(code)
      if (!alreadyHeld) press(binding.action)
      return true
    },
    keyUp(code: string) {
      if (!down.delete(code)) return
      const binding = bindings.find(candidate => candidate.keys?.includes(code))
      if (binding?.held && !binding.keys?.some(key => down.has(key))) release(binding.action)
    },
    pointerDown(button: number) {
      const binding = bindings.find(candidate => candidate.mouseButton === button)
      if (!binding) return false
      press(binding.action)
      return true
    },
    reset() {
      down.clear()
    },
  }
}
