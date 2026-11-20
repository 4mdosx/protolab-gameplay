import type { HistoricalShip } from './types'

/** Temporary, fictional hulls used for the prototype; no historical provenance is implied. */
export const historicalShips: HistoricalShip[] = [
  { id:'demo-destroyer', name:'实验驱逐舰', shipClass:'destroyer', configurations:[{ id:'standard', shipClass:'destroyer', layer:'surface', speed:5, stats:{hp:72,pwr:28,def:22,acc:45,eva:62,sen:85,stl:55}, armor:{kinetic:.8,underwater:1.2}, weaponSlots:[{slotId:'main',weaponId:'destroyerGun'},{slotId:'torpedo',weaponId:'torpedo'}], equipmentSlot:{slotId:'utility'} }] },
  { id:'demo-cruiser', name:'实验巡洋舰', shipClass:'cruiser', configurations:[{ id:'standard', shipClass:'cruiser', layer:'surface', speed:3, stats:{hp:105,pwr:42,def:48,acc:55,eva:38,sen:58,stl:30}, armor:{kinetic:1,underwater:1}, weaponSlots:[{slotId:'main',weaponId:'cruiserGun'}], equipmentSlot:{slotId:'utility'} }] },
  { id:'demo-battleship', name:'实验战列舰', shipClass:'battleship', configurations:[
    { id:'twin', shipClass:'battleship', layer:'surface', speed:2, stats:{hp:155,pwr:65,def:75,acc:60,eva:20,sen:38,stl:20}, armor:{kinetic:1.4,underwater:.7}, weaponSlots:[{slotId:'main',weaponId:'battleshipTwin'}], equipmentSlot:{slotId:'utility'} },
    { id:'triple', shipClass:'battleship', layer:'surface', speed:2, stats:{hp:155,pwr:65,def:75,acc:60,eva:20,sen:38,stl:20}, armor:{kinetic:1.4,underwater:.7}, weaponSlots:[{slotId:'main',weaponId:'battleshipTriple'}], equipmentSlot:{slotId:'utility'} },
  ] },
  { id:'demo-carrier', name:'实验航空母舰', shipClass:'carrier', configurations:[{ id:'standard', shipClass:'carrier', layer:'surface', speed:5, stats:{hp:60,pwr:32,def:18,acc:50,eva:65,sen:70,stl:35}, armor:{kinetic:.8,underwater:1.2}, weaponSlots:[{slotId:'main',weaponId:'carrierAirGroup'}], equipmentSlot:{slotId:'utility'} }] },
  { id:'demo-submarine', name:'实验潜航单位', shipClass:'submarine', configurations:[{ id:'standard', shipClass:'submarine', layer:'submerged', speed:3, stats:{hp:80,pwr:35,def:30,acc:45,eva:40,sen:40,stl:80}, armor:{kinetic:.8,underwater:1.2}, weaponSlots:[{slotId:'main',weaponId:'torpedo'}], equipmentSlot:{slotId:'utility'} }] },
]
