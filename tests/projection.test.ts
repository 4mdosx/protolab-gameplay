import { expect, it } from 'vitest'
import { flightOffset, flightPoint } from '../experiments/fleet-collection/dogfight/projection'
it('applies the same zoom-scaled visual offset without altering ground coordinates',()=>{const ground={x:10,y:20};const unit=flightPoint(ground,4),bullet=flightPoint(ground,4);expect(unit).toEqual(bullet);expect(unit.y).toBeLessThan(ground.y);expect(ground).toEqual({x:10,y:20});expect(flightOffset(8)).toBeCloseTo(flightOffset(4)*2)})
