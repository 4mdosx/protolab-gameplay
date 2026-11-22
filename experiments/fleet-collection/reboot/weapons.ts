export const BARRAGES = {
  destroyer: { recoilForce: 105, recoilDuration: 0.18, rounds: 2, waves: 2, interval: 0.25, cooldown: 4, radius: 0.45, spread: 0, speed: 55 },
  cruiser: { recoilForce: 240, recoilDuration: 0.22, rounds: 2, waves: 3, interval: 0.3, cooldown: 6, radius: 0.65, spread: 0, speed: 50 },
  battleship: { recoilForce: 800, recoilDuration: 0.28, rounds: 3, waves: 3, interval: 0.4, cooldown: 9, radius: 1, spread: Math.PI / 18, speed: 45 },
}
export type WeaponClass = keyof typeof BARRAGES
