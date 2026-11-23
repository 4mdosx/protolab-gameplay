import type { World } from '../engine/world'

export const ENERGY = { capacity: 100, regen: 14, fullDrain: 18, brakeDrain: 24, dashCost: 25, dashDuration: 0.35, dashCooldown: 1.2, dashPower: 2.5 }

export function energySystem(world: World, dt: number) {
  if (!(dt > 0)) return
  const dashRequested = world.input.dashRequested
  world.input.dashRequested = false
  for (const id of world.ids) {
    const state = world.energy.get(id), command = world.command.get(id), motion = world.motion.get(id)
    if (!state || !command || !motion) continue
    state.dashCooldown = Math.max(0, state.dashCooldown - dt)
    if (state.locked && state.value >= 20) state.locked = false
    const braking = !!world.input.brake
    if (dashRequested && !braking && !state.locked && state.dashCooldown === 0 && state.value >= ENERGY.dashCost) {
      state.value -= ENERGY.dashCost
      state.dashLeft = ENERGY.dashDuration
      state.dashCooldown = ENERGY.dashCooldown
    }
    if (braking) state.dashLeft = 0
    command.braking = braking && !state.locked && state.value > 0
    command.dashFraction = !braking ? Math.min(dt, state.dashLeft) / dt : 0
    state.dashLeft = Math.max(0, state.dashLeft - dt)
    if (braking) command.power = 0
    let drain = 0
    if (command.braking && Math.hypot(motion.velocity.x, motion.velocity.y) > 0.05) drain = ENERGY.brakeDrain
    else if (!braking && command.power >= 1 && command.dashFraction === 0) {
      if (state.locked || state.value <= 0) command.power = 0.35
      else drain = ENERGY.fullDrain
    }
    if (drain > 0) {
      const fraction = Math.min(1, state.value / (drain * dt))
      if (command.braking) command.brakeFraction = fraction
      else command.power = 0.35 + (command.power - 0.35) * fraction
      state.value = Math.max(0, state.value - drain * dt)
    } else if (command.dashFraction === 0 && state.dashLeft === 0) state.value = Math.min(ENERGY.capacity, state.value + ENERGY.regen * dt)
    if (state.value <= 1e-6) state.locked = true
  }
}
