import { characters } from './characters'
import { historicalShips } from './historical-ships'
import { weapons } from './weapons'
import { aiModules } from './ai'
import { aircraftConfigs } from './aircraft'
export { characters, historicalShips, weapons, aiModules, aircraftConfigs }
export type * from './types'
export function resolveCharacter(index: number) {
  const character = characters[index]
  if (!character) throw new Error(`unknown character index: ${index}`)
  const historicalShip = historicalShips.find(ship => ship.id === character.historicalShipId)
  if (!historicalShip) throw new Error(`missing historical ship for ${character.id}`)
  const hull = historicalShip.configurations.find(config => config.id === character.configurationId)
  if (!hull) throw new Error(`missing hull configuration for ${character.id}`)
  if (character.shipClass !== hull.shipClass || character.shipClass !== historicalShip.shipClass) throw new Error(`class mismatch for ${character.id}`)
  const ai = aiModules[character.aiId]
  if (!ai) throw new Error(`missing AI for ${character.id}`)
  if (!hull.weaponSlots.length || new Set(hull.weaponSlots.map(slot => slot.slotId)).size !== hull.weaponSlots.length) throw new Error(`invalid weapon slots for ${character.id}`)
  const weaponSlots = hull.weaponSlots.map(slot => {
    const weapon = weapons[slot.weaponId]
    if (!weapon) throw new Error(`missing weapon ${slot.weaponId} for ${character.id}`)
    if (weapon.delivery === 'aircraft') {
      resolveAircraft(weapon.summonId ?? '')
      if (!Number.isInteger(weapon.maxActive) || weapon.maxActive! < 0) throw new Error(`invalid aircraft capacity for ${character.id}: ${slot.slotId}`)
    }
    if (!weapon.spread.length || weapon.spread.length !== weapon.mounts * weapon.barrelsPerMount || weapon.spread.some(angle => !Number.isFinite(angle))) throw new Error(`invalid projectile spread for ${character.id}`)
    return { slotId: slot.slotId, weaponId: slot.weaponId, weapon: { ...weapon, spread: [...weapon.spread] }, readyAt: 0 }
  })
  return { ...hull, ...character, stats: { ...hull.stats }, armor: { ...hull.armor }, weaponSlots, equipmentSlot: { ...hull.equipmentSlot }, ai: { ...ai }, preferredRange: ai.preferredRange, personality: (ai.id === 'artillery' ? 'kite' : 'advance') as 'kite' | 'advance' }
}

export function resolveAircraft(id: string) {
  const aircraft = aircraftConfigs[id]
  if (!aircraft) throw new Error(`unknown aircraft configuration: ${id}`)
  const weapon = weapons[aircraft.weaponId], ai = aiModules[aircraft.aiId]
  if (!weapon || weapon.delivery === 'aircraft' || !ai) throw new Error(`invalid aircraft weapon or AI: ${id}`)
  if (!weapon.spread.length || weapon.spread.length !== weapon.mounts * weapon.barrelsPerMount || weapon.spread.some(angle => !Number.isFinite(angle)) || !(aircraft.lifetime > 0)) throw new Error(`invalid aircraft configuration: ${id}`)
  return { ...aircraft, stats: { ...aircraft.stats }, armor: { ...aircraft.armor }, ai: { ...ai }, weapon: { ...weapon, spread: [...weapon.spread] } }
}
