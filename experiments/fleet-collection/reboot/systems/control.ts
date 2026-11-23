import { lockedTarget, type World } from '../engine/world'

const THROTTLE_POWER = [0, 0.1, 0.35, 1] as const
const LOCK_HEADING_GAIN = 2

/** Resolve manual input into independent thrust and hull turn commands. */
export function controlSystem(world: World) {
  for (const id of world.ids) {
    const pilot = world.pilot.get(id)
    const body = world.body.get(id)
    const motion = world.motion.get(id)
    if (pilot?.scheme !== 'manual' || !body || !motion) continue
    const aim = world.input.aim
    const pointerHeading = aim ? Math.atan2(aim.y - body.y, aim.x - body.x) : body.heading
    const pointerCanSteer = aim !== null && Math.hypot(aim.x - body.x, aim.y - body.y) > 1
    const target = lockedTarget(world, id)
    const weaponMode = !target && !!world.input.selectedGun
    let turn = world.input.turn
    if (target) {
      const error = Math.atan2(target.y - body.y, target.x - body.x) - body.heading
      const shortestError = Math.atan2(Math.sin(error), Math.cos(error))
      turn = LOCK_HEADING_GAIN * shortestError / motion.maxTurnRate
    }
    const previous = world.command.get(id)
    world.command.set(id, {
      power: weaponMode || pointerCanSteer ? THROTTLE_POWER[world.input.throttle] : 0,
      thrustAngle: weaponMode
        ? previous?.thrustAngle ?? body.heading + Math.PI
        : pointerHeading + (world.input.reverseControl ? 0 : Math.PI),
      turn: Math.max(-1, Math.min(1, turn)),
    })
  }
}
