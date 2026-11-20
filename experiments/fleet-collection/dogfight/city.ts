import { createRandom } from '../../../packages/simulation'
import type { TerrainBox } from './terrain'

export const CHUNK_SIZE = 120
const BLOCK = 30
const ROAD = 8
export interface CityChunk { key: string; x: number; y: number; buildings: TerrainBox[] }
export interface CityMap { seed: number; chunks: Record<string, CityChunk>; activeKey: string; buildings: TerrainBox[] }
function hash(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}
/** Continuous coast function, with land at y >= coastY(x). */
export function coastY(seed: number, x: number): number {
  const spacing = 80, i = Math.floor(x / spacing), t = x / spacing - i, smooth = t * t * (3 - 2 * t)
  const value = (n: number) => -12 + (hash(seed, n, 914) / 4294967295 - .5) * 18
  return value(i) * (1 - smooth) + value(i + 1) * smooth
}
export function generateChunk(seed: number, cx: number, cy: number): CityChunk {
  const random = createRandom(hash(seed ^ 0x63c17a5b, cx, cy)), buildings: TerrainBox[] = []
  // Four-by-four city blocks align globally across chunk boundaries. Each block has two parcels.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = cx * CHUNK_SIZE + col * BLOCK + ROAD / 2, y = cy * CHUNK_SIZE + row * BLOCK + ROAD / 2
    for (let part = 0; part < 2; part++) {
      const bx = x + part * 11 + 1, by = y + 1 + random() * 2, width = 7 + random() * 2, height = 13 + random() * 5
      // The coast is monotonic between 80-unit control points, so endpoints and
      // any enclosed control point contain the maximum along the full footprint.
      const coastSamples = [bx, bx + width]
      for (let knot = Math.ceil(bx / 80) * 80; knot < bx + width; knot += 80) coastSamples.push(knot)
      const onLand = coastSamples.every(sample => by >= coastY(seed, sample) + 3)
      // Preserve initial deployment and its central approach corridor.
      const spawn = bx < 29 && bx + width > 10 && by < 88 && by + height > 12 || bx < 110 && bx + width > 91 && by < 88 && by + height > 12
      const corridor = bx < 95 && bx + width > 25 && by < 60 && by + height > 50
      // Water uses a conservative margin to keep buildings off river and lake banks.
      let clearWater = true
      for (let sy = by - 4; sy <= by + height + 4; sy += 3) for (let sx = bx - 4; sx <= bx + width + 4; sx += 3) if (waterAt(seed, sx, sy)) clearWater = false
      if (!onLand || !clearWater || spawn || corridor || random() < .1) continue
      const tower = random() < 0.22
      buildings.push({ id: `${cx}:${cy}:${row}:${col}:${part}`, x: bx, y: by, width, height, kind: tower ? 'tower' : 'low', elevation: tower ? 18 + random() * 12 : 3 + random() * 4, blocks: tower ? ['surface', 'submerged'] : [] })
    }
  }
  return { key: `${cx},${cy}`, x: cx, y: cy, buildings }
}
export function updateCity(city: CityMap, points: {x:number;y:number}[]): CityMap {
  const keys = new Set<string>()
  for (const p of points) { const cx = Math.floor(p.x / CHUNK_SIZE), cy = Math.floor(p.y / CHUNK_SIZE); for (let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) keys.add(`${cx+dx},${cy+dy}`) }
  const ordered = [...keys].sort(), activeKey = ordered.join('|')
  if (activeKey === city.activeKey) return city
  const chunks: Record<string, CityChunk> = {}
  for (const key of ordered) { const [x,y] = key.split(',').map(Number); chunks[key] = city.chunks[key] ?? generateChunk(city.seed,x,y) }
  return { seed: city.seed, chunks, activeKey, buildings: ordered.flatMap(key => chunks[key].buildings) }
}
export function generateCity(seed: number): CityMap { return updateCity({ seed, chunks: {}, activeKey: '', buildings: [] }, [{x:15,y:50},{x:105,y:50}]) }

/** Two continuous rivers flow toward the coast. Lakes lie on these channels. */
export function riverX(seed: number, river: number, y: number): number {
  const phase = (hash(seed, river, 723) / 4294967295) * Math.PI * 2
  return (river === 0 ? -35 : 170) + 14 * Math.sin(y / 95 + phase) + 5 * Math.sin(y / 37 + phase * .5)
}
export function waterAt(seed: number, x: number, y: number): boolean {
  if (y < coastY(seed, x)) return true
  for (let river = 0; river < 2; river++) {
    const dx = x - riverX(seed, river, y)
    if (Math.abs(dx) < 5) return true
    // A periodic chain of lakes intersects the river, so each has an outlet.
    const k = Math.round((y - 100 - river * 60) / 320), lakeY = 100 + river * 60 + k * 320
    const lakeX = riverX(seed, river, lakeY)
    if (((x-lakeX)/16)**2 + ((y-lakeY)/12)**2 < 1) return true
  }
  return false
}
