import { BARRAGES } from './weapons'
import { HANDLING } from './flight-config'
import type { World, Id } from './engine/world'

export { HANDLING }
export type HandlingId = keyof typeof HANDLING

/** Live tuning preserves position and momentum; new forces apply from the next tick. */
export function applyHandling(world: World, id: Id, profile: HandlingId) {
  const motion = world.motion.get(id)
  if (!motion) return
  const { label: _label, ...parameters } = HANDLING[profile]
  Object.assign(motion, parameters)
  for (const gun of world.drones.get(id) ?? []) {
    gun.barrage = BARRAGES[profile][gun.side === -1 ? 0 : 1]
    gun.wavesLeft = 0
    // Preserve reload when switching to avoid bypassing cooldown.
  }
}
