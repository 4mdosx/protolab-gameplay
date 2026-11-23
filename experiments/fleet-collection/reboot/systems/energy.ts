import type { Energy } from '../components'
import { ENERGY } from '../flight-config'

export function spendEnergy(energy: Energy, amount: number) {
  energy.value = Math.max(0, energy.value - amount)
  if (energy.value <= 1e-8) {
    energy.value = 0
    energy.locked = true
  }
}

export function recoverEnergy(energy: Energy, dt: number) {
  energy.value = Math.min(ENERGY.capacity, energy.value + ENERGY.regen * dt)
  if (energy.value >= ENERGY.unlockAt) energy.locked = false
}
