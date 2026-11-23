export interface BarrageSpec {
  readonly rounds: number
  readonly waves: number
  readonly interval: number
  readonly cooldown: number
  readonly radius: number
  readonly spread: number
  readonly speed: number
  readonly recoilForce: number
  readonly recoilDuration: number
}

const STANDARD_BARRAGES = {
  destroyer: { recoilForce: 105, recoilDuration: 0.18, rounds: 1, waves: 3, interval: 0.25, cooldown: 4, radius: 0.45, spread: 0, speed: 55 },
  cruiser: { recoilForce: 240, recoilDuration: 0.22, rounds: 1, waves: 3, interval: 0.3, cooldown: 6, radius: 0.65, spread: 0, speed: 50 },
  battleship: { recoilForce: 800, recoilDuration: 0.28, rounds: 1, waves: 3, interval: 0.4, cooldown: 9, radius: 1, spread: 0, speed: 45 },
}
export type WeaponClass = keyof typeof STANDARD_BARRAGES

/** The left and right mounts can be tuned independently in each loadout. */
export const BARRAGES: Record<WeaponClass, readonly [BarrageSpec, BarrageSpec]> = {
  destroyer: [STANDARD_BARRAGES.destroyer, STANDARD_BARRAGES.destroyer],
  cruiser: [STANDARD_BARRAGES.cruiser, STANDARD_BARRAGES.cruiser],
  battleship: [
    { ...STANDARD_BARRAGES.battleship, rounds: 2, spread: Math.PI / 9 },
    STANDARD_BARRAGES.battleship,
  ],
}
