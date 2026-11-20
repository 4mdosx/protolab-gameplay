import { expect, it } from 'vitest'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
it('open sea keeps its battlefield free of buildings across chunk boundaries', () => { let b=createDogfight(42,[0],[0],17,true);b.ships=b.ships.map(s=>({...s,x:s.x+500}));b=stepDogfight(b);expect(b.terrain).toEqual([]) })
