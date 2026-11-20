import { characters } from '../config'
export type Scene = 'sea' | 'city'
export interface BattleSettings { blue: (string | null)[]; red: (string | null)[]; seed: string; mapSeed: string; speed: string }
export interface Preset { name: string; settings: BattleSettings }
export interface SettingsStore { version: 1; scenes: Partial<Record<Scene, { current?: BattleSettings; presets: Preset[] }>> }
export const STORAGE_KEY = 'fleet-collection.dogfight.settings.v1'
export const defaults = (): BattleSettings => ({ blue:[...characters.slice(0,3).map(c=>c.id),null,null,null], red:[...characters.slice(0,3).map(c=>c.id),null,null,null], seed:'42',mapSeed:'17',speed:'4' })
function validSettings(value: unknown): value is BattleSettings {
  if (!value || typeof value !== 'object') return false
  const s = value as BattleSettings, ids = new Set(characters.map(c=>c.id))
  const lineup = (v: unknown) => Array.isArray(v) && v.length === 6 && v.every(id => id === null || typeof id === 'string' && ids.has(id))
  return lineup(s.blue) && lineup(s.red) && typeof s.seed === 'string' && typeof s.mapSeed === 'string' && ['1','2','4','8'].includes(s.speed)
}
export function validForBattle(s: BattleSettings): boolean {
  return !!s.blue.some(Boolean) && !!s.red.some(Boolean) && s.seed.trim() !== '' && s.mapSeed.trim() !== '' && Number.isSafeInteger(Number(s.seed)) && Number.isSafeInteger(Number(s.mapSeed))
}
export function readStore(storage: Pick<Storage,'getItem'>): SettingsStore {
  try {
    const parsed=JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || parsed.version!==1 || typeof parsed.scenes!=='object' || !parsed.scenes) return {version:1,scenes:{}}
    const scenes: SettingsStore['scenes']={}
    for (const scene of ['sea','city'] as const) {
      const entry=parsed.scenes[scene]; if(!entry || typeof entry!=='object')continue
      scenes[scene]={current:validSettings(entry.current)?entry.current:undefined,presets:Array.isArray(entry.presets)?entry.presets.filter((p: Preset)=>p && typeof p.name==='string' && p.name.trim().length>0 && validSettings(p.settings) && validForBattle(p.settings)).slice(0,20):[]}
    }
    return {version:1,scenes}
  } catch { return {version:1,scenes:{}} }
}
export function writeStore(storage: Pick<Storage,'setItem'>, store: SettingsStore): boolean {
  try { storage.setItem(STORAGE_KEY,JSON.stringify(store));return true } catch { return false }
}
export function lineupIndices(slots: (string | null)[]): number[] {return slots.filter((id): id is string=>id!==null).map(id=>characters.findIndex(c=>c.id===id))}
