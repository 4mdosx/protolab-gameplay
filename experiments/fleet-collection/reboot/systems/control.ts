import type { World } from '../engine/world'

/** Manual pilot: pointer steers exhaust by default; throttle selects engine force. */
export function controlSystem(world: World) {
  for (const id of world.ids) {
    const pilot = world.pilot.get(id)
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    if (pilot?.scheme !== 'manual' || !body || !motion) continue
    const aim = world.input.aim
    const facing = aim ? Math.atan2(aim.y - body.y, aim.x - body.x) : body.heading
    const weaponMode = !!world.input.selectedGun
    const previous = world.command.get(id)
    world.command.set(id, {
      power: weaponMode || (aim && Math.hypot(aim.x - body.x, aim.y - body.y) > 1) ? [0, 0.1, 0.35, 1][world.input.throttle] : 0,
      thrustAngle: weaponMode ? (previous?.thrustAngle ?? body.heading + Math.PI) : facing + (world.input.reverseControl ? 0 : Math.PI),
      turn: Math.max(-1, Math.min(1, world.input.turn)),
    })
  }
}
