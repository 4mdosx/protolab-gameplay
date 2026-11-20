import type { Layer } from '../battle/model'
export interface TerrainBox { id: string; x: number; y: number; width: number; height: number; blocks: Layer[] }
/** Earliest segment entry into a box, expanded by the unit radius. */
export function boxEntry(a: { x: number; y: number }, b: { x: number; y: number }, box: TerrainBox, radius = 0): number | null {
  let start = 0, end = 1
  for (const [p, delta, lo, hi] of [[a.x, b.x-a.x, box.x-radius, box.x+box.width+radius], [a.y, b.y-a.y, box.y-radius, box.y+box.height+radius]]) {
    if (Math.abs(delta) < 1e-9) { if (p < lo || p > hi) return null; continue }
    const t1 = (lo-p)/delta, t2 = (hi-p)/delta
    start = Math.max(start, Math.min(t1,t2)); end = Math.min(end, Math.max(t1,t2))
    if (start > end) return null
  }
  return start >= 0 && start <= 1 ? start : null
}
export function terrainImpact(a: {x:number;y:number}, b: {x:number;y:number}, layer: Layer, boxes: TerrainBox[], radius = 0): number | null {
  const minX = Math.min(a.x,b.x)-radius, maxX = Math.max(a.x,b.x)+radius
  const minY = Math.min(a.y,b.y)-radius, maxY = Math.max(a.y,b.y)+radius
  const hits = boxes.filter(box => box.blocks.includes(layer) && box.x <= maxX && box.x + box.width >= minX && box.y <= maxY && box.y + box.height >= minY).map(box => boxEntry(a,b,box,radius)).filter((t): t is number => t !== null)
  return hits.length ? Math.min(...hits) : null
}
