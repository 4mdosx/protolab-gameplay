export type Team = 'blue' | 'red'
export type Personality = 'advance' | 'kite'
export type DamageType = 'kinetic' | 'underwater'
export type Layer = 'surface' | 'air' | 'submerged'
export type ShipClass = 'destroyer' | 'cruiser' | 'battleship' | 'aircraft' | 'submarine'
export interface Stats { hp: number; pwr: number; def: number; acc: number; eva: number; sen: number; stl: number }
export interface Weapon { id: string; delivery: 'ballistic' | 'torpedo'; damage: DamageType; range: number; cooldown: number; power: number; accuracy: number; projectileSpeed: number; spread: number[] }
export interface AiModule { id: string; name: string; useCover: boolean; preferredRange: number; orbitStrength: number; dodgeStrength: number; turnRate: number; turnAcceleration: number }
export interface CharacterConfig { id: string; name: string; shipClass: ShipClass; layer: Layer; speed: number; stats: Stats; armor: Record<DamageType, number>; weaponId: string; aiId: string }
