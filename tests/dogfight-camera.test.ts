import { describe, expect, it } from 'vitest'
import { targetCamera, smoothCamera } from '../experiments/fleet-collection/dogfight/camera'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
describe('open battlefield and camera', () => {
  it('tracks widely separated units and adjusts zoom', () => { const c=targetCamera([{x:-200,y:0},{x:300,y:100}],960,600)!;expect(c.x).toBe(50);expect(c.scale).toBeLessThan(2);expect(smoothCamera({x:0,y:0,scale:8},c,.1).x).toBeGreaterThan(0) })
  it('allows units and projectiles outside the former field', () => { let b=createDogfight(42);b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?120:300,y:150}));const before=b.ships.find(s=>s.id==='blue-0')!;b=stepDogfight(b);expect(b.ships.find(s=>s.id==='blue-0')!.x).toBeGreaterThan(before.x) })
})
