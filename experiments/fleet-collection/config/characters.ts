import type { CharacterConfig } from './types'
/** Original placeholder characters for testing; not representations of existing IP. */
export const characters: CharacterConfig[] = [
  { id:'scout-destroyer', name:'晴岚', shipClass:'destroyer', historicalShipId:'demo-destroyer', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'destroyer-raid', aggressiveness:.7, initiative:.7 } },
  { id:'escort-cruiser', name:'澄波', shipClass:'cruiser', historicalShipId:'demo-cruiser', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'cruiser-escort', aggressiveness:.4, initiative:.5 } },
  { id:'artillery-battleship', name:'苍岳', shipClass:'battleship', historicalShipId:'demo-battleship', configurationId:'twin', sourceId:'prototype', strategy:{ strategyId:'battleship-artillery', aggressiveness:.3, initiative:.4 } },
  { id:'carrier', name:'云雀', shipClass:'carrier', historicalShipId:'demo-carrier', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'carrier-standoff', aggressiveness:.25, initiative:.6 } },
  { id:'submarine', name:'深澜', shipClass:'submarine', historicalShipId:'demo-submarine', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'submarine-ambush', aggressiveness:.4, initiative:.35 } },
  { id:'artillery-battleship-triple', name:'远岫', shipClass:'battleship', historicalShipId:'demo-battleship', configurationId:'triple', sourceId:'prototype', strategy:{ strategyId:'battleship-push', aggressiveness:.65, initiative:.55 } },
  { id:'destroyer-second', name:'夕汐', shipClass:'destroyer', historicalShipId:'demo-destroyer', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'destroyer-screen', aggressiveness:.32, initiative:.4 } },
  { id:'cruiser-second', name:'星汐', shipClass:'cruiser', historicalShipId:'demo-cruiser', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'cruiser-flank', aggressiveness:.72, initiative:.65 } },
  { id:'carrier-second', name:'轻羽', shipClass:'carrier', historicalShipId:'demo-carrier', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'carrier-mobile', aggressiveness:.55, initiative:.8 } },
  { id:'submarine-second', name:'夜潮', shipClass:'submarine', historicalShipId:'demo-submarine', configurationId:'standard', sourceId:'prototype', strategy:{ strategyId:'submarine-hunt', aggressiveness:.8, initiative:.75 } },
]
