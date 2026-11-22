import type { Camera } from '../../dogfight/camera'
import { coastY, riverX, type CityMap } from '../../dogfight/city'
import type { TerrainBox } from '../../dogfight/terrain'
import { viewBounds, worldToScreen } from './view'

export interface Facade { depth: number; x: number; y: number; w: number; h: number }

function project(camera: Camera, width: number, height: number, x: number, y: number) {
  return worldToScreen(camera, width, height, { x, y })
}

/** Land, coastline, rivers and the street grid. Open water is the canvas color underneath. */
export function drawTerrain(ctx: CanvasRenderingContext2D, camera: Camera, city: CityMap) {
  const { width, height } = ctx.canvas
  const bounds = viewBounds(camera, width, height)
  ctx.fillStyle = '#112635'
  ctx.fillRect(0, 0, width, height)
  const coast = []
  const step = Math.max(10, (bounds.right - bounds.left) / 200)
  for (let x = bounds.left; x < bounds.right; x += step) coast.push(project(camera, width, height, x, coastY(city.seed, x)))
  coast.push(project(camera, width, height, bounds.right, coastY(city.seed, bounds.right)))
  ctx.fillStyle = '#273e3b'
  ctx.beginPath()
  ctx.moveTo(coast[0].x, height)
  for (const point of coast) ctx.lineTo(point.x, point.y)
  ctx.lineTo(coast[coast.length - 1].x, height)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#8aab93'
  ctx.lineWidth = 3
  ctx.beginPath()
  coast.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
  ctx.stroke()
  for (let river = 0; river < 2; river++) {
    ctx.strokeStyle = '#214b60'
    ctx.lineWidth = 10 * camera.scale
    ctx.beginPath()
    for (let i = 0; i <= 80; i++) {
      const y = bounds.top + (bounds.bottom - bounds.top) * i / 80
      const x = riverX(city.seed, river, y)
      const point = project(camera, width, height, x, y)
      if (y >= coastY(city.seed, x)) i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
      else ctx.moveTo(point.x, point.y)
    }
    ctx.stroke()
    const first = Math.ceil((bounds.top - 100 - river * 60) / 320)
    const last = Math.floor((bounds.bottom - 100 - river * 60) / 320)
    for (let k = first; k <= last && k < first + 40; k++) {
      const y = 100 + river * 60 + k * 320
      const x = riverX(city.seed, river, y)
      if (y < coastY(city.seed, x)) continue
      const point = project(camera, width, height, x, y)
      ctx.fillStyle = '#214b60'
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, 16 * camera.scale, 12 * camera.scale * 0.78, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.strokeStyle = '#405151'
  ctx.lineWidth = Math.max(1, 2 * camera.scale)
  for (let x = Math.floor(bounds.left / 30) * 30; x <= bounds.right; x += 30) {
    const point = project(camera, width, height, x, 0)
    ctx.beginPath()
    ctx.moveTo(point.x, 0)
    ctx.lineTo(point.x, height)
    ctx.stroke()
  }
  for (let y = Math.floor(bounds.top / 30) * 30; y <= bounds.bottom; y += 30) {
    const point = project(camera, width, height, 0, y)
    ctx.beginPath()
    ctx.moveTo(0, point.y)
    ctx.lineTo(width, point.y)
    ctx.stroke()
  }
}

/** One building. Towers also return the facade rectangle used to hide a ship behind them. */
export function drawBuilding(ctx: CanvasRenderingContext2D, camera: Camera, box: TerrainBox): Facade | null {
  const { width, height } = ctx.canvas
  const bounds = viewBounds(camera, width, height)
  if (box.x + box.width < bounds.left || box.x > bounds.right || box.y + box.height < bounds.top - 50 || box.y > bounds.bottom + 50) return null
  const origin = worldToScreen(camera, width, height, box)
  const w = box.width * camera.scale
  const h = box.height * camera.scale * 0.78
  const elevation = (box.elevation ?? 5) * camera.scale * 0.7
  const tower = box.kind === 'tower'
  if (tower) {
    ctx.strokeStyle = '#e6bd69'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.strokeRect(origin.x, origin.y, w, h)
    ctx.setLineDash([])
  }
  ctx.fillStyle = tower ? '#3b4f56' : '#334b48'
  ctx.fillRect(origin.x, origin.y + h - elevation, w, elevation)
  ctx.fillStyle = tower ? '#78999c' : '#58716a'
  ctx.fillRect(origin.x, origin.y - elevation, w, h)
  ctx.strokeStyle = tower ? '#b8e2dc' : '#66817a'
  ctx.lineWidth = tower ? 2 : 1
  ctx.strokeRect(origin.x, origin.y - elevation, w, h)
  if (!tower) return null
  return { depth: box.y + box.height, x: origin.x, y: origin.y - elevation, w, h }
}
