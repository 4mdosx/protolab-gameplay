import type { World } from '../engine/world'

/** Manual pilot: keys set velocity, the pointer sets facing and the gun aim. */
export function controlSystem(world: World) {
  for (const id of world.ids) {
    const pilot = world.pilot.get(id)
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    if (pilot?.scheme !== 'manual' || !body || !motion) continue
    let x = world.input.x
    let y = world.input.y
    const length = Math.hypot(x, y)
    if (length > 1) { x /= length; y /= length }
    const aim = world.input.aim
    const facing = aim ? Math.atan2(aim.y - body.y, aim.x - body.x) : body.heading
    world.command.set(id, {
      velocity: { x: x * motion.cruise, y: y * motion.cruise },
      facing,
      aim: aim ? facing : null,
    })
  }
}
