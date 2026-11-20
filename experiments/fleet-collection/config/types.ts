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
export type AiTactic = 'search' | 'approach' | 'attack' | 'cover' | 'evade'
/** Conditions read the resolved variant, so one tree yields different transitions after parameters are applied. */
export type AiCondition = 'noTarget' | 'hasTarget' | 'tooClose' | 'inBand' | 'outOfBand' | 'cooling' | 'ready' | 'blocked' | 'open' | 'incoming' | 'cover'
export interface StateBranch { when: AiCondition[]; to: string }
export interface StateNode { id: string; tactic: AiTactic; branches: StateBranch[] }
export interface StrategyBase {
  preferredRange: number
  orbitStrength: number
  dodgeStrength: number
  turnRate: number
  turnAcceleration: number
  useCover: boolean
  /** Fraction of preferred range inside which the ship is too close. */
  disengageRatio: number
  /** Fraction of preferred range inside which the ship can hold and fight. */
  engageRatio: number
}
/** A ship-class tactic. The tree is fixed; aggressiveness and initiative scale it per character. */
export interface Strategy {
  id: string
  name: string
  shipClass: ShipClass | 'aircraft'
  root: string
  states: StateNode[]
  base: StrategyBase
}
export interface StrategyMount {
  strategyId: string
  /** 0 keeps distance, 1 seeks a closer fight. */
  aggressiveness: number
  /** 0 waits, 1 starts acting from farther away and dodges harder. */
  initiative: number
}
/** Resolved copy hung on a ship. Parameters have already been applied. */
export interface AiModule extends StrategyBase {
  id: string
  name: string
  strategyId: string
  aggressiveness: number
  initiative: number
  personality: Personality
  root: string
  states: StateNode[]
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
  strategy: StrategyMount
}

/** Summoned combat units are not collectible characters or historical ships. */
export interface AircraftConfig {
  id: string
  name: string
  stats: Stats
  speed: number
  armor: Record<DamageType, number>
  strategy: StrategyMount
  weaponId: string
  lifetime: number
}
