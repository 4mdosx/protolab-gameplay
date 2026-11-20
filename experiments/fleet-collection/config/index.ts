import { characters } from './characters'
import { weapons } from './weapons'
import { aiModules } from './ai'
export { characters, weapons, aiModules }
export type * from './types'
export function resolveCharacter(index: number) {
  const character = characters[index]
  if (!character) throw new Error(`unknown character index: ${index}`)
  const weapon = weapons[character.weaponId], ai = aiModules[character.aiId]
  if (!weapon || !ai) throw new Error(`missing weapon or AI for ${character.id}`)
  if (!weapon.spread.length || weapon.spread.some(angle => !Number.isFinite(angle))) throw new Error(`invalid projectile spread for ${character.id}`)
  return { ...character, stats: { ...character.stats }, armor: { ...character.armor }, weapon: { ...weapon, spread: [...weapon.spread] }, ai: { ...ai }, preferredRange: ai.preferredRange, personality: (ai.id === 'artillery' ? 'kite' : 'advance') as 'kite' | 'advance' }
}
