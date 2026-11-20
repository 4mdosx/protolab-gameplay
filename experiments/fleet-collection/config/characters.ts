import type { CharacterConfig } from './types'
export const characters: CharacterConfig[] = [
  { id:'scout-destroyer', name:'侦察驱逐', shipClass:'destroyer', layer:'surface', speed:5, stats:{hp:72,pwr:28,def:22,acc:45,eva:62,sen:85,stl:55}, armor:{kinetic:.8,underwater:1.2}, weaponId:'torpedo',aiId:'scout' },
  { id:'escort-cruiser', name:'护卫巡洋', shipClass:'cruiser', layer:'surface', speed:3, stats:{hp:105,pwr:42,def:48,acc:55,eva:38,sen:58,stl:30}, armor:{kinetic:1,underwater:1}, weaponId:'gun',aiId:'escort' },
  { id:'artillery-battleship', name:'炮击战列', shipClass:'battleship', layer:'surface', speed:2, stats:{hp:155,pwr:65,def:75,acc:60,eva:20,sen:38,stl:20}, armor:{kinetic:1.4,underwater:.7}, weaponId:'gun',aiId:'artillery' },
  { id:'aircraft', name:'航空单位', shipClass:'aircraft', layer:'air', speed:5, stats:{hp:60,pwr:32,def:18,acc:50,eva:65,sen:70,stl:35}, armor:{kinetic:.8,underwater:1.2}, weaponId:'gun',aiId:'aviation' },
  { id:'submarine', name:'潜航单位', shipClass:'submarine', layer:'submerged', speed:3, stats:{hp:80,pwr:35,def:30,acc:45,eva:40,sen:40,stl:80}, armor:{kinetic:.8,underwater:1.2}, weaponId:'torpedo',aiId:'scout' },
]
