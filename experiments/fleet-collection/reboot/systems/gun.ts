import type { World } from '../engine/world'

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Slew the mount toward the aim. Past the arc, the mount stops on the edge and the aim is dead. */
export function gunSystem(world: World, dt: number) {
  for (const id of world.ids) {
    const body = world.body.get(id)
    const gun = world.gun.get(id)
    const command = world.command.get(id)
    if (!body || !gun || !command) continue
    if (command.aim === null) { gun.dead = false; gun.aim = null; continue }
    const local = wrap(command.aim - body.heading)
    const limit = clamp(local, -gun.arc, gun.arc)
    gun.dead = Math.abs(local) > gun.arc + 1e-4
    gun.local += clamp(limit - gun.local, -gun.traverse * dt, gun.traverse * dt)
    gun.aim = command.aim
  }
}
