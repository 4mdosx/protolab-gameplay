import type { World, Id } from '../engine/world'
import type { Pose } from '../components'
import type { Camera } from './view'
import { worldToScreen } from './view'
import { flightPoint } from '../../dogfight/projection'

export function drawDrones(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  world: World,
  id: Id,
  pose: Pose,
) {
  const at = (x: number, y: number) =>
    flightPoint(worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, { x, y }), camera.scale)
  ctx.save()
  for (const [index, gun] of (world.drones.get(id) ?? []).entries()) {
    const side = pose.heading + (gun.side * Math.PI) / 2
    const x = pose.x + Math.cos(side) * 4.5,
      y = pose.y + Math.sin(side) * 4.5
    const p = at(x, y)
    const selected = world.input.selectedGun === index + 1
    const color = selected ? '#ffe8a6' : '#c5a357'
    {
      ctx.fillStyle = selected ? '#ffda8030' : '#ffda8012'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      for (let i = 0; i <= 40; i++) {
        const angle = pose.heading + gun.center - gun.arc + (2 * gun.arc * i) / 40
        const edge = at(x + Math.cos(angle) * 11, y + Math.sin(angle) * 11)
        ctx.lineTo(edge.x, edge.y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = selected ? '#ffda8099' : '#ffda8044'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      if (selected) ctx.strokeRect(p.x - 9, p.y - 9, 18, 18)
    }
    ctx.fillStyle = '#172d39'
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const angle = pose.heading + gun.local
    const tip = at(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.font = '11px monospace'
    ctx.fillText(`${index + 1} ${gun.name}`, p.x - 3, p.y - 13)
    ctx.fillText(
      gun.wavesLeft
        ? `连射 ${gun.wavesLeft} 波`
        : gun.cooldown > 0
          ? `装填 ${gun.cooldown.toFixed(1)}s`
          : '就绪',
      p.x + 12,
      p.y + 12,
    )
    if (selected && gun.dead) {
      ctx.fillStyle = '#ff8d7a'
      ctx.fillText('死区', p.x + 12, p.y)
    }
  }
  ctx.restore()
}
