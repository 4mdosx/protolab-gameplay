import '../battle/style.css'
import { createClock, advance, SIM_STEP } from './engine/clock'
import { createWorld, manualShip, stepWorld } from './engine/world'
import { drawFrame } from './render/frame'
import { followCamera, screenToWorld } from './render/view'
import type { Camera } from './render/view'

const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `<header><a href="/">← 实验室</a><h1>手控驱逐</h1><p>固定 0.1 秒一拍。WASD 或方向键给速度，鼠标给船头和炮口。</p></header><section class="controls"><button id="play">暂停</button><button id="step">推进 0.1 秒</button><span id="status"></span></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="手控驱逐战场"></canvas><p class="hint">白线是速度，三角是船头，金色短线是炮口。暗色扇区是主炮死区：鼠标落在里面时，炮停在射界边上，红色虚线指向瞄不到的方向。低楼可穿过，高楼的金色虚线框会挡住船体。</p></section><aside><h2>这一拍</h2><div id="events"></div></aside></div>`

const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const status = document.querySelector<HTMLElement>('#status')!
const events = document.querySelector<HTMLElement>('#events')!
const play = document.querySelector<HTMLButtonElement>('#play')!
const world = createWorld(17)
const shipId = manualShip(world)!
const body = world.body.get(shipId)!
let camera: Camera = { x: body.x, y: body.y, scale: 5, vx: 0, vy: 0, vScale: 0 }
let clock = createClock()
let running = true
let last = performance.now()
let alpha = 1
const held = new Set<string>()
let pointer: { x: number; y: number } | null = null
const moveKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

function sampleInput() {
  const x = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0)
  const y = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0)
  world.input = { x, y, aim: pointer ? screenToWorld(camera, canvas.width, canvas.height, pointer.x, pointer.y) : null }
}

function paint() {
  const current = world.body.get(shipId)!
  camera = followCamera(camera, current, running ? 1 / 60 : SIM_STEP)
  drawFrame(ctx, world, camera, shipId, alpha)
  const motion = world.motion.get(shipId)!
  const gun = world.gun.get(shipId)!
  const speed = Math.hypot(motion.velocity.x, motion.velocity.y)
  status.textContent = `${world.time.toFixed(1)} 秒 · ${world.ship.get(shipId)!.name} · ${current.x.toFixed(0)}, ${current.y.toFixed(0)} · 速度 ${speed.toFixed(1)} · ${gun.dead ? '炮在死区' : '炮在射界内'}`
  play.textContent = running ? '暂停' : '继续'
  events.innerHTML = `<p>船头 ${(current.heading * 180 / Math.PI).toFixed(0)}°</p><p>炮相对船头 ${(gun.local * 180 / Math.PI).toFixed(0)}°</p><p>射界 ±${(gun.arc * 180 / Math.PI).toFixed(0)}°</p><p>${pointer ? '鼠标正在瞄准' : '鼠标离开战场，船头保持'}</p>`
}

function frame(now: number) {
  const seconds = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  sampleInput()
  if (running) {
    const advanced = advance(clock, seconds)
    clock = advanced.clock
    alpha = advanced.alpha
    for (let i = 0; i < advanced.steps; i++) stepWorld(world)
  }
  paint()
  requestAnimationFrame(frame)
}

play.onclick = () => { running = !running; if (!running) alpha = 1; paint() }
document.querySelector<HTMLButtonElement>('#step')!.onclick = () => {
  if (running) return
  sampleInput()
  stepWorld(world)
  alpha = 1
  paint()
}
addEventListener('keydown', event => {
  const key = event.key.toLowerCase()
  if (moveKeys.has(key)) event.preventDefault()
  if (!event.repeat) held.add(key)
})
addEventListener('keyup', event => held.delete(event.key.toLowerCase()))
addEventListener('blur', () => held.clear())
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect()
  pointer = { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }
})
canvas.addEventListener('pointerleave', () => { pointer = null })
requestAnimationFrame(frame)
