import type { AircraftConfig } from './types'
/** Prototype summoned unit; it is never a selectable shipgirl. */
export const aircraftConfigs: Record<string, AircraftConfig> = {
  'fighter-scout': { id: 'fighter-scout', name: '舰载机', speed: 6, stats: { hp: 24, pwr: 28, def: 12, acc: 48, eva: 60, sen: 20, stl: 35 }, armor: { kinetic: .8, underwater: 1 }, strategy: { strategyId: 'aircraft-strike', aggressiveness: .8, initiative: .85 }, weaponId: 'aircraftGun', lifetime: 25 },
}
