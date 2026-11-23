import type { Energy } from '../components'

export const ENERGY = { capacity: 100, regen: 14, fullDrain: 18, brakeDrain: 24, unlockAt: 20 }

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
