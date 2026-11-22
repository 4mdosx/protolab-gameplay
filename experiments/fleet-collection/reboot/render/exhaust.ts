import type { Pose } from '../components'
import type { World, Id } from '../engine/world'
import type { Camera } from './view'
import { worldToScreen } from './view'
import { flightPoint } from '../../dogfight/projection'

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; nozzle: boolean; size: number }
interface Trail { time: number; sparks: Spark[] }
// Visual history belongs to the renderer, never to the simulation components.
const trails = new WeakMap<World, Map<Id, Trail>>()

export function drawExhaust(ctx: CanvasRenderingContext2D, camera: Camera, world: World, id: Id, pose: Pose, time: number) {
  let ships = trails.get(world)
  if (!ships) { ships = new Map(); trails.set(world, ships) }
  let trail = ships.get(id)
  if (!trail || time < trail.time) { trail = { time, sparks: [] }; ships.set(id, trail) }
  const command = world.command.get(id)
  const braking = command?.braking && Math.hypot(pose.vx, pose.vy) > 0.05
  const power = braking ? 1.5 : command?.dashFraction ? 2.5 : command?.power ?? 0
  const angle = braking ? Math.atan2(pose.vy, pose.vx) : (command?.thrustAngle ?? pose.heading) + Math.PI
  const elapsed = Math.max(0, Math.min(0.15, time - trail.time))
  if (elapsed > 0) {
    const count = Math.ceil(elapsed / 0.015)
    for (let i = 0; i < count; i++) {
      const age = elapsed * i / count
      const x = pose.x - pose.vx * age
      const y = pose.y - pose.vy * age
      if (power > 0) trail.sparks.push({ x: x + Math.cos(angle) * 1.8, y: y + Math.sin(angle) * 1.8,
        vx: pose.vx * 0.2 + Math.cos(angle) * (7 + power * 12), vy: pose.vy * 0.2 + Math.sin(angle) * (7 + power * 12),
        born: time - age, life: 0.35 + power * 0.3, nozzle: true, size: 0.25 + power * 0.35 })
      if (Math.hypot(pose.vx, pose.vy) > 0.5) trail.sparks.push({ x: x - Math.cos(pose.heading) * 2, y: y - Math.sin(pose.heading) * 2,
        vx: 0, vy: 0, born: time - age, life: 2.5, nozzle: false, size: 0.35 })
    }
  }
  trail.time = time
  trail.sparks = trail.sparks.filter(spark => time - spark.born < spark.life)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const history = trail.sparks.filter(spark => !spark.nozzle)
  ctx.globalCompositeOperation = 'source-over'
  ctx.lineWidth = 1
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1], b = history[i]
    const p = flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, a), camera.scale)
    const q = flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, b), camera.scale)
    ctx.globalAlpha = (1 - (time - b.born) / b.life) * 0.65
    ctx.strokeStyle = '#69d5ef'
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
    if (i % 10 === 0) {
      ctx.beginPath(); ctx.moveTo(q.x - 3, q.y - 3); ctx.lineTo(q.x + 3, q.y + 3); ctx.stroke()
    }
  }
  // Inertial route: one-second ticks, independent of the hull and nozzle.
  const recoiling = (world.recoil.get(id) ?? []).some(pulse => pulse.remaining > 0)
  if (!recoiling && Math.hypot(pose.vx, pose.vy) > 0.5) {
    ctx.globalAlpha = 0.65; ctx.strokeStyle = '#b1f6de'; ctx.fillStyle = '#b1f6de'
    ctx.setLineDash([5, 5]); ctx.beginPath()
    for (let i = 0; i <= 3; i++) {
      const p = flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height,
        { x: pose.x + pose.vx * i, y: pose.y + pose.vy * i }), camera.scale)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke(); ctx.setLineDash([])
    ctx.font = '10px monospace'
    for (let i = 1; i <= 3; i++) {
      const p = flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height,
        { x: pose.x + pose.vx * i, y: pose.y + pose.vy * i }), camera.scale)
      ctx.strokeRect(p.x - 3, p.y - 3, 6, 6); ctx.fillText(`+${i}s`, p.x + 6, p.y - 5)
    }
  }
  ctx.globalCompositeOperation = 'lighter'
  for (const spark of trail.sparks) {
    if (!spark.nozzle) continue
    const age = Math.max(0, time - spark.born)
    const fade = 1 - age / spark.life
    const point = flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height,
      { x: spark.x + spark.vx * age, y: spark.y + spark.vy * age }), camera.scale)
    ctx.globalAlpha = fade * (spark.nozzle ? 0.85 : 0.5)
    ctx.fillStyle = spark.nozzle ? (fade > 0.7 ? '#fff0b0' : '#ff783e') : '#69d5ef'
    ctx.beginPath()
    ctx.ellipse(point.x, point.y, spark.size * camera.scale * (1 + age), spark.size * camera.scale * 0.65 * (1 + age), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
