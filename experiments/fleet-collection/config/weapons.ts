import type { Weapon } from './types'
/** Angle offsets are radians; power is distributed evenly across projectiles. */
export const weapons: Record<string, Weapon> = {
  gun: { id: '主炮', delivery: 'ballistic', damage: 'kinetic', range: 52, cooldown: 4, power: .46, accuracy: .85, projectileSpeed: 30, spread: [-.14, 0, .14] },
  torpedo: { id: '鱼雷', delivery: 'torpedo', damage: 'underwater', range: 30, cooldown: 7, power: .75, accuracy: .7, projectileSpeed: 30, spread: [-.14, 0, .14] },
}
