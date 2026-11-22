import type { Vec, Projectile } from '../components'
import type { World, Id } from '../engine/world'

export function segmentCircle(a: Vec, b: Vec, center: Vec, radius: number): number | null {
  const dx = b.x - a.x, dy = b.y - a.y, x = a.x - center.x, y = a.y - center.y
  const c = x * x + y * y - radius * radius
  if (c <= 0) return 0
  const length = dx * dx + dy * dy
  if (length < 1e-12) return null
  const dot = x * dx + y * dy, disc = dot * dot - length * c
  if (disc < 0) return null
  const t = (-dot - Math.sqrt(disc)) / length
  return t >= 0 && t <= 1 ? t : null
}

export function damageShip(world: World, id: Id, shot: Projectile) {
  const ship = world.ship.get(id), body = world.body.get(id)
  if (!ship || !body) return
  const incoming = Math.atan2(-shot.vy, -shot.vx)
  const rear = Math.abs(Math.atan2(Math.sin(incoming - body.heading - Math.PI), Math.cos(incoming - body.heading - Math.PI))) <= Math.PI / 4
  ship.hp = Math.max(0, ship.hp - 10 * (rear ? 1.5 : 1))
  shot.life = 0
}
