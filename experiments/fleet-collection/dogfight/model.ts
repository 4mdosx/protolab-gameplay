import { createBattle, type Battle, type Ship, type Team, type Layer } from '../battle/model'
import type { TerrainBox } from './terrain'
import { generateCity, updateCity, type CityMap } from './city'
import { moveFleet } from './movement'
import { resolveProjectiles } from './projectiles'
import { updateIntel } from './intel'
export { hitTime, sweptHit, canAttack } from './combat'

export interface Projectile { id: number; team: Team; source: string; target: string; x: number; y: number; vx: number; vy: number; remaining: number; power: number; damage: 'kinetic' | 'underwater'; accuracy: number; acc: number; lock: number; layer?: Layer }
export interface Dogfight extends Battle { projectiles: Projectile[]; nextProjectile: number; shots: number; collisions: number; hits: number; dodges: number; headings: Record<string, number>; turnRates: Record<string, number>; terrain: TerrainBox[]; city: CityMap; openSea: boolean; navigation: Record<string, { targetId: string; nextCheck: number; waypoint: {x:number;y:number} | null }>; cover: Record<string, { targetId: string; goal: {x:number;y:number} | null; waypoint: {x:number;y:number} | null; replanAt: number; until: number; retryAt: number; anchor?: {x:number;y:number}; radius?: number }>; orbits: Record<string, {x:number;y:number; kind: 'enemy' | 'building'}>; tactics: Record<string, 'search' | 'cover' | 'attack' | 'evade'> }
export const DT = 0.1
export function createDogfight(seed: number, lineup: number[] = [0, 1, 2], red: number[] = [0, 1, 2], mapSeed = 17, openSea = false): Dogfight {
  const city = generateCity(mapSeed)
  return { ...createBattle(seed, lineup, red), projectiles: [], nextProjectile: 0, shots: 0, collisions: 0, hits: 0, dodges: 0, headings: {}, turnRates: {}, terrain: openSea ? [] : city.buildings, city, openSea, navigation: {}, cover: {}, orbits: {}, tactics: {} }
}
export function stepDogfight(b: Dogfight): Dogfight {
  if (b.result) return b
  const alive = b.ships.filter(s => s.hp > 0)
  const city = b.openSea ? b.city : updateCity(b.city, [...alive, ...b.projectiles])
  const obstacles = city === b.city ? b.terrain : city.buildings
  const events: string[] = []
  const intel = updateIntel(b, alive, DT, events)
  const { moved, headings, turnRates, navigation, cover, tactics, orbits } = moveFleet(b, alive, intel, obstacles, events)
  const {nextProjectile, shots, collisions, hits, dodges, projectiles, damage} = resolveProjectiles(b, alive, moved, intel, obstacles, events)
  const ships=b.ships.map(s=>{const m=moved.get(s.id)??s,hp=Math.max(0,m.hp-(damage.get(s.id)??0));if(s.hp>0&&hp===0)events.push(`${s.team==='blue'?'蓝':'红'}方 ${s.name}退出战斗`);return {...m,hp}})
  const blue=ships.some(s=>s.team==='blue'&&s.hp>0),red=ships.some(s=>s.team==='red'&&s.hp>0),tick=b.tick+1,time=Math.round(tick*DT*10)/10
  const result=!blue&&!red?'draw':!blue?'red':!red?'blue':time>=180?'draw':null
  return {...b,city,terrain: obstacles,ships,intel,headings,turnRates,navigation,cover,orbits,tactics,projectiles,nextProjectile,shots,collisions,hits,dodges,tick,time,result,events:[...b.events,...events.map(e=>`${time.toFixed(1)}s ${e}`)].slice(-120)}
}
