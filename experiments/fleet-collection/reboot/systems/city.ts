import type { World } from '../engine/world'
import { updateCity } from '../../dogfight/city'

/** Keep the city chunks around every hull. The generator itself stays in the city module. */
export function citySystem(world: World) {
  const points = world.ids.flatMap((id) => {
    const body = world.body.get(id)
    return body ? [{ x: body.x, y: body.y }] : []
  })
  if (points.length) world.city = updateCity(world.city, points)
}
