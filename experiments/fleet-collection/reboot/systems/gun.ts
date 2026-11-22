import type { World } from '../engine/world'
import { damageShip, segmentCircle } from './hit'
import { BARRAGES } from '../weapons'
import { terrainImpact } from '../../dogfight/terrain'

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Slew the mount toward the aim. Past the arc, the mount stops on the edge and the aim is dead. */
export function gunSystem(world: World, dt: number) {
  if (!(dt > 0)) return
  for (const shot of world.projectiles) {
    const next = { x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt }
    const wall = terrainImpact(shot, next, 'surface', world.city.buildings, shot.radius)
    let first = wall ?? Infinity
    let target: number | undefined
    for (const id of world.ids) {
      if (shot.owner === id || (world.ship.get(id)?.hp ?? 0) <= 0 || (world.dashVisual.get(id)?.evade ?? 0) > 0) continue
      const body = world.body.get(id)
      if (!body) continue
      const hit = segmentCircle(shot, next, body, 2 + shot.radius)
      if (hit !== null && hit < first) { first = hit; target = id }
    }
    if (shot.life > 0 && target !== undefined) damageShip(world, target, shot)
    else if (wall !== null) shot.life = 0
    shot.x = next.x; shot.y = next.y; shot.life -= dt
  }
  world.projectiles = world.projectiles.filter(shot => shot.life > 0)
  const requests = world.input.fireQueue?.splice(0) ?? []
  for (const id of world.ids) {
    const body = world.body.get(id)
    if (!body) continue
    for (const [index, drone] of (world.drones.get(id) ?? []).entries()) {
      if (world.input.selectedGun === index + 1 && world.input.aim) {
        const sideAngle = body.heading + drone.side * Math.PI / 2
        const x = body.x + Math.cos(sideAngle) * 4.5
        const y = body.y + Math.sin(sideAngle) * 4.5
        drone.target = wrap(Math.atan2(world.input.aim.y - y, world.input.aim.x - x) - body.heading)
      }
      drone.dead = Math.abs(wrap(drone.target - drone.center)) > drone.arc
      const target = drone.center + clamp(wrap(drone.target - drone.center), -drone.arc, drone.arc)
      drone.local = clamp(drone.local + clamp(target - drone.local, -drone.traverse * dt, drone.traverse * dt), drone.center - drone.arc, drone.center + drone.arc)
      const spec = BARRAGES[drone.weaponClass]
      drone.cooldown = Math.max(0, drone.cooldown - dt)
      if (drone.wavesLeft === 0 && drone.cooldown <= 1e-6 && world.pilot.get(id)?.scheme === 'manual' && requests.some(selected => selected === 0 || selected === index + 1)) {
        drone.wavesLeft = spec.waves; drone.waveTimer = dt
      }
      if (drone.wavesLeft > 0) {
        drone.waveTimer -= dt
        while (drone.wavesLeft > 0 && drone.waveTimer <= 1e-6) {
          const sideAngle = body.heading + drone.side * Math.PI / 2
          const barrel = body.heading + drone.local
          const velocity = world.motion.get(id)?.velocity ?? { x: 0, y: 0 }
          for (let round = 0; round < spec.rounds; round++) {
            const offset = round - (spec.rounds - 1) / 2
            const angle = barrel + offset * spec.spread
            const spacing = offset * (spec.radius * 2 + 0.3)
            world.projectiles.push({
              x: body.x + Math.cos(sideAngle) * 4.5 + Math.cos(barrel) * 3 - Math.sin(barrel) * spacing,
              y: body.y + Math.sin(sideAngle) * 4.5 + Math.sin(barrel) * 3 + Math.cos(barrel) * spacing,
              vx: Math.cos(angle) * spec.speed + velocity.x, vy: Math.sin(angle) * spec.speed + velocity.y,
              owner: id, life: 3, radius: spec.radius, weapon: index + 1,
            })
          }
          // One sustained force pulse per wave, using the actual launch directions.
          const pulses = world.recoil.get(id) ?? []
          let fx = 0, fy = 0
          for (let round = 0; round < spec.rounds; round++) {
            const angle = barrel + (round - (spec.rounds - 1) / 2) * spec.spread
            fx -= Math.cos(angle) * spec.recoilForce / spec.rounds
            fy -= Math.sin(angle) * spec.recoilForce / spec.rounds
          }
          pulses.push({ fx, fy, remaining: spec.recoilDuration })
          world.recoil.set(id, pulses)
          drone.wavesLeft--
          drone.waveTimer += spec.interval
          if (drone.wavesLeft === 0) drone.cooldown = spec.cooldown
        }
      }
    }
  }
}
