import { describe, expect, it } from 'vitest'
import { focusCamera, targetCamera, smoothCamera } from '../experiments/fleet-collection/dogfight/camera'
import { createDogfight, stepDogfight } from '../experiments/fleet-collection/dogfight/model'
describe('open battlefield and camera', () => {
  it('tracks widely separated units and adjusts zoom', () => { const c=targetCamera([{x:-200,y:0},{x:300,y:100}],960,600)!;expect(c.x).toBe(50);expect(c.scale).toBeLessThan(2);expect(smoothCamera({x:0,y:0,scale:8},c,.1).x).toBeGreaterThan(0) })
  it('glides toward a new framing instead of arriving in one step', () => {
    const target = { x: 100, y: 40, scale: 4 }
    const first = smoothCamera({ x: 0, y: 0, scale: 8 }, target, 1 / 60)
    const second = smoothCamera(first, target, 1 / 60)
    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(second.x)
    expect(second.x).toBeLessThan(target.x)
    expect(second.x - first.x).toBeGreaterThan(first.x)
    expect(first.scale).toBeLessThan(8)
    expect(first.scale).toBeGreaterThan(second.scale)
    expect(second.scale).toBeGreaterThan(target.scale)
  })
  it('focuses the selected unit and its target, zooming out as they separate', () => {
    const near = focusCamera({ x: 0, y: 0 }, { x: 30, y: 0 }, 960, 600)
    const far = focusCamera({ x: 0, y: 0 }, { x: 240, y: 0 }, 960, 600)
    expect(near).toMatchObject({ x: 15, y: 0 })
    expect(far).toMatchObject({ x: 120, y: 0 })
    expect(near.scale).toBeGreaterThan(far.scale)
    expect(far.scale * 240).toBeLessThan(960)
    expect(focusCamera({ x: 10, y: 20 }, null, 960, 600)).toMatchObject({ x: 10, y: 20 })
  })
  it('uses the engagement chosen during movement', () => {
    let b = createDogfight(42, [0], [0], 17, true)
    b.intel = { blue: { 'red-0': 100 }, red: { 'blue-0': 100 } }
    b = stepDogfight(b)
    expect(b.targets['blue-0']).toBe('red-0')
    expect(b.targets['red-0']).toBe('blue-0')
  })
  it('allows units and projectiles outside the former field', () => { let b=createDogfight(42);b.ships=b.ships.map(s=>({...s,x:s.team==='blue'?120:300,y:150}));const before=b.ships.find(s=>s.id==='blue-0')!;b=stepDogfight(b);expect(b.ships.find(s=>s.id==='blue-0')!.x).toBeGreaterThan(before.x) })
})
