export type Team = 'blue' | 'red'
export type Personality = 'advance' | 'kite'
export type DamageType = 'kinetic' | 'underwater'
export type Layer = 'surface' | 'air' | 'submerged'
export type ShipClass = 'destroyer' | 'cruiser' | 'battleship' | 'carrier' | 'submarine'
export interface Stats {
  hp: number
  pwr: number
  def: number
  acc: number
  eva: number
  sen: number
  stl: number
}
export interface Weapon {
  id: string
  model: string
  tier: number
  mounts: number
  barrelsPerMount: number
  delivery: 'ballistic' | 'torpedo' | 'aircraft'
  damage: DamageType
  range: number
  cooldown: number
  power: number
  accuracy: number
  projectileSpeed: number
  spread: number[]
  summonId?: string
  maxActive?: number
}
export interface AiModule {
  id: string
  name: string
  useCover: boolean
  preferredRange: number
  orbitStrength: number
  dodgeStrength: number
  turnRate: number
  turnAcceleration: number
}
/** Identity and its historically meaningful equipment configurations. */
export interface HullConfiguration {
  id: string
  era?: string
  configurationYear?: number
  shipClass: ShipClass
  layer: Layer
  speed: number
  stats: Stats
  armor: Record<DamageType, number>
  weaponSlots: { slotId: string; weaponId: string }[]
  equipmentSlot: { slotId: string }
}
export interface HistoricalShip {
  id: string
  name: string
  shipClass: ShipClass
  nation?: string
  hullNumber?: string
  configurations: HullConfiguration[]
}
/** A collectible personality; several characters may share a historical ship and configuration. */
export interface CharacterConfig {
  id: string
  name: string
  shipClass: ShipClass
  historicalShipId: string
  configurationId: string
  sourceId: string
  aiId: string
}

/** Summoned combat units are not collectible characters or historical ships. */
export interface AircraftConfig {
  id: string
  name: string
  stats: Stats
  speed: number
  armor: Record<DamageType, number>
  aiId: string
  weaponId: string
  lifetime: number
}
