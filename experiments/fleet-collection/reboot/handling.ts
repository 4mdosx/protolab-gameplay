import type { Motion } from './components'
import type { World, Id } from './engine/world'

type Parameters = Omit<Motion, 'velocity'>
export const HANDLING = {
  destroyer: { label: '驱逐（轻型）', mass: 7, thrust: 175, drag: 175 / 34 ** 2, lateralGrip: 1.2, maxLateralAccel: 10, inertia: 45, torque: 108, maxTurnRate: 1.2 },
  cruiser: { label: '巡洋（标准）', mass: 12, thrust: 216, drag: 216 / 30 ** 2, lateralGrip: 0.7, maxLateralAccel: 6, inertia: 120, torque: 144, maxTurnRate: 0.8 },
  battleship: { label: '战列（重型）', mass: 40, thrust: 320, drag: 320 / 24 ** 2, lateralGrip: 0.35, maxLateralAccel: 2.5, inertia: 800, torque: 320, maxTurnRate: 0.4 },
} satisfies Record<string, Parameters & { label: string }>
export type HandlingId = keyof typeof HANDLING

/** Live tuning preserves position and momentum; new forces apply from the next tick. */
export function applyHandling(world: World, id: Id, profile: HandlingId) {
  const motion = world.motion.get(id)
  if (!motion) return
  const { label: _label, ...parameters } = HANDLING[profile]
  Object.assign(motion, parameters)
  for (const gun of world.drones.get(id) ?? []) {
    gun.weaponClass = profile
    gun.wavesLeft = 0
    // Preserve reload when switching to avoid bypassing cooldown.
  }
}
