import type { Battle, Ship, Team } from '../battle/model'
const distance = (a: Ship, b: Ship) => Math.hypot(a.x-b.x,a.y-b.y)
const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
export function updateIntel(b: Battle, alive: Ship[], dt: number, events: string[]): Battle['intel'] {
  const intel: Battle['intel'] = {blue:{...b.intel.blue},red:{...b.intel.red}}
  for (const team of ['blue','red'] as Team[]) for (const target of alive.filter(s=>s.team!==team)) {
    const sensors = alive.filter(s=>s.team===team).map(s=>s.stats.sen/(1+(distance(s,target)/60)**2)).sort((a,c)=>c-a)
    const strength=(sensors[0]??0)+0.3*sensors.slice(1).reduce((a,c)=>a+c,0), prev=intel[team][target.id]??0
    const value=clamp(prev+8*2*strength/(strength+target.stats.stl)*dt,0,100); intel[team][target.id]=value
    if(prev<40&&value>=40) events.push(`${team==='blue'?'蓝方':'红方'}发现 ${target.name}`)
    if(prev<100&&value>=100) events.push(`${team==='blue'?'蓝方':'红方'}锁定 ${target.name}`)
  }
  return intel
}
