import { describe, expect, it } from 'vitest'
import { defaults, readStore, writeStore, validForBattle, lineupIndices, STORAGE_KEY, type SettingsStore } from '../experiments/fleet-collection/dogfight/settings'
function memory(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}}
describe('session settings',()=>{
  it('round-trips separate scenes, slot positions and multiple presets',()=>{const storage=memory(),a=defaults(),b=defaults();a.blue=[null,a.blue[0],null,a.blue[1],null,null];const store:SettingsStore={version:1,scenes:{city:{current:a,presets:[{name:'A',settings:a},{name:'B',settings:b}]},sea:{current:b,presets:[]}}};expect(writeStore(storage,store)).toBe(true);expect(readStore(storage)).toEqual(store);expect(lineupIndices(a.blue)).toEqual([0,1])})
  it('ignores malformed data and unknown character ids',()=>{const storage=memory();storage.setItem(STORAGE_KEY,'broken');expect(readStore(storage)).toEqual({version:1,scenes:{}});const s=defaults();s.blue[0]='missing';storage.setItem(STORAGE_KEY,JSON.stringify({version:1,scenes:{city:{current:s,presets:[{name:'bad',settings:s}]}}}));expect(readStore(storage).scenes.city).toEqual({current:undefined,presets:[]})})
  it('rejects incomplete battle setups and reports storage failures',()=>{const s=defaults();s.seed='';expect(validForBattle(s)).toBe(false);s.seed='42';s.blue.fill(null);expect(validForBattle(s)).toBe(false);expect(writeStore({setItem(){throw new Error('blocked')}},{version:1,scenes:{}})).toBe(false)})
})
