import '../battle/style.css'
import { HANDLING, applyHandling, type HandlingId } from './handling'
import { createClock, advance, SIM_STEP } from './engine/clock'
import { createWorld, manualShip, stepWorld } from './engine/world'
import { drawFrame } from './render/frame'
import { followCamera, screenToWorld } from './render/view'
import type { Camera } from './render/view'

const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `<header><a href="/">← 实验室</a><h1>低空战斗平台</h1><p>固定 0.1 秒一拍。鼠标指定喷口方向（加速度朝反方向），勾选「控制反向」后朝鼠标方向加速，A / D 转船头，W / S 升降档位，0 切空档；按住 X 制动，Shift 短时 Dash（驱逐额外突进 8 米，落点闪避 0.12 秒，高楼会阻挡）；空格开火（未选炮全炮齐射，选中则仅发射该炮）。1 / 2 选中两侧浮游炮，选炮期间喷口方向锁定，再按同一编号或 Esc 返回驾驶。调整喷口方向可刹车。</p></header><section class="controls"><label>操控参数 <select id="handling"></select></label><button id="play">暂停</button><button id="step">推进 0.1 秒</button><label>出力 <select id="throttle"><option value="0">空档</option><option value="1">1 · 10% 微调</option><option value="2">2 · 35% 巡航</option><option value="3">3 · 100% 强推</option></select></label><label><input type="checkbox" id="reverse-control" checked>控制反向（朝鼠标加速）</label><label>能量 <meter id="energy" min="0" max="100" value="100"></meter><span id="energy-status"></span></label><span id="status"></span></section><p id="mode-hint" role="status" aria-live="polite" style="padding:12px;border:1px solid;border-radius:8px"></p><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="低空战斗平台战场"></canvas><p class="hint">镜头随实际速度平滑拉远（8 m/s 以下近景，60 m/s 达最远）。白线是速度，橙色尾焰表示喷口方向与出力，蓝色 HUD 航迹保留最近 2.5 秒的移动路径，绿色虚线为当前速度的 3 秒惯性路线（不计后续推力与碰撞），浅蓝色前后喷焰用于转向与角速度制动；沿船头阻力小、横移阻力大；独立飞控提供有限侧向辅助，转船头配合主喷口可收紧弯道。几何小人为机体，金色面罩指向船头；双腿与脚底尾焰指示喷口方向，身体倾斜与手臂后摆反映实际加速度，1 号为身侧单个浮游主炮，2 号为浮游副炮。红色船尾扇区为背部弱装甲提示（来自后方 ±45° 的炮弹伤害 ×1.5）。驱逐舰 2发×2波 / 巡洋舰 2发×3波 / 战列舰 3发扇形×3波；末波后装填 4/6/9 秒，炮弹碰撞半径 0.45/0.65/1 米。黄色扇形始终显示可用射界，选中时加亮，超出射界时炮停在边缘。低楼可穿过，高楼的金色虚线框会挡住船体。</p></section><aside><h2>这一拍</h2><div id="events"></div></aside></div>`

const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const status = document.querySelector<HTMLElement>('#status')!
const events = document.querySelector<HTMLElement>('#events')!
const play = document.querySelector<HTMLButtonElement>('#play')!
const world = createWorld(17)
const shipId = manualShip(world)!
const body = world.body.get(shipId)!
const handling = document.querySelector<HTMLSelectElement>('#handling')!
handling.innerHTML = Object.entries(HANDLING).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')
handling.value = 'cruiser'
handling.onchange = () => { applyHandling(world, shipId, handling.value as HandlingId); paint() }

let camera: Camera = { x: body.x, y: body.y, scale: 5, vx: 0, vy: 0, vScale: 0 }
let clock = createClock()
let running = true
let last = performance.now()
let alpha = 1
let pointer: { x: number; y: number } | null = null
let selectedGun: 0 | 1 | 2 = 0
const fireQueue: (0 | 1 | 2)[] = []
const held = new Set<string>()
const throttle = document.querySelector<HTMLSelectElement>('#throttle')!
const reverseControl = document.querySelector<HTMLInputElement>('#reverse-control')!
function sampleInput() {
  world.input = { brake: held.has('x'), dashRequested: world.input.dashRequested, fireQueue, selectedGun, reverseControl: reverseControl.checked, turn: Number(held.has('d')) - Number(held.has('a')), throttle: Number(throttle.value) as 0 | 1 | 2 | 3, aim: pointer ? screenToWorld(camera, canvas.width, canvas.height, pointer.x, pointer.y) : null }
}

function paint(seconds = 1 / 60) {
  const weaponMode = selectedGun !== 0
  canvas.style.cursor = weaponMode ? 'crosshair' : 'move'
  canvas.style.outline = `2px solid ${weaponMode ? '#ffda80' : '#69d5d4'}`
  const hint = document.querySelector<HTMLElement>('#mode-hint')!
  hint.style.color = weaponMode ? '#ffda80' : '#69d5d4'
  hint.textContent = weaponMode
    ? `武器模式 · ${selectedGun} 号炮｜鼠标调整炮口，喷口世界方向已锁定｜空格单炮开火｜再按 ${selectedGun} 或 Esc 返回驾驶｜W/S 调出力 · X 制动 · Shift 沿锁定方向 Dash · 0 空档`
    : '驾驶模式｜X 制动 · Shift Dash｜鼠标调整喷口｜A/D 转船头 · W/S 调出力 · 0 空档｜1/2 进入武器模式｜空格全炮齐射'

  const energy = world.energy.get(shipId)!
  document.querySelector<HTMLMeterElement>('#energy')!.value = energy.value
  document.querySelector<HTMLElement>('#energy-status')!.textContent = ` ${energy.value.toFixed(0)}/100 · ${energy.dashLeft > 0 ? 'Dash 中' : energy.dashCooldown > 0 ? 'Dash 冷却 ' + energy.dashCooldown.toFixed(1) + 's' : 'Dash 就绪'}${energy.locked ? ' · 低能量：恢复至20后解锁' : ''}`
  const current = world.body.get(shipId)!
  const velocity = world.motion.get(shipId)!.velocity
  camera = followCamera(camera, current, seconds, Math.hypot(velocity.x, velocity.y))
  drawFrame(ctx, world, camera, shipId, alpha)
  const motion = world.motion.get(shipId)!
  const gun = world.drones.get(shipId)?.[selectedGun - 1]
  const speed = Math.hypot(motion.velocity.x, motion.velocity.y)
  status.textContent = `${world.time.toFixed(1)} 秒 · ${world.ship.get(shipId)!.name} · ${current.x.toFixed(0)}, ${current.y.toFixed(0)} · HP ${world.ship.get(shipId)!.hp.toFixed(0)} · 速度 ${speed.toFixed(1)} · ${gun ? gun.name + (gun.dead ? '：目标在死区' : '：目标在射界内') : '未选炮'}`
  play.textContent = running ? '暂停' : '继续'
  events.innerHTML = `<p>${HANDLING[handling.value as HandlingId].label} · 满推加速度 ${(motion.thrust / motion.mass).toFixed(1)} m/s² · 最大转速 ${(motion.maxTurnRate * 180 / Math.PI).toFixed(0)}°/s</p><p>质量 ${motion.mass} t · 推力 ${(motion.thrust * (world.command.get(shipId)?.power ?? 0)).toFixed(0)} kN</p><p>本档沿船头平衡速度（非限速） ${Math.sqrt(motion.thrust * [0, .1, .35, 1][Number(throttle.value)] / motion.drag).toFixed(1)} m/s</p><p>后坐力：${(world.recoil.get(shipId)?.length ?? 0) > 0 ? "作用中" : "无"}（每波反向推力，可与推进力抵消）</p><p>船头 ${(current.heading * 180 / Math.PI).toFixed(0)}°</p><p>浮游炮：${selectedGun ? selectedGun + " 号设置朝向" : "未选中"} · 转速 60°/s · 左右各向外偏 30° · 半射界 40° · 前方重叠 20°</p><p>${selectedGun ? '喷口方向锁定；退出武器模式后恢复鼠标驾驶' : pointer ? '鼠标控制喷口方向' : '鼠标离开战场，停止施力'}</p>`
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
  paint(seconds)
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
  if (event.target instanceof HTMLSelectElement) return
  const key = event.key.toLowerCase()
  if (!['a', 'd', 'w', 's', ' ', '0', '1', '2', '3', 'escape', 'x', 'shift'].includes(key)) return
  event.preventDefault()
  held.add(key)
  if (event.repeat) return
  if (key === 'w' || key === 's') throttle.value = String(Math.max(0, Math.min(3, Number(throttle.value) + (key === 'w' ? 1 : -1))))
  if (key === '1' || key === '2') selectedGun = selectedGun === Number(key) ? 0 : Number(key) as 1 | 2
  if (key === 'escape') selectedGun = 0
  if (key === 'shift') world.input.dashRequested = true
  if (key === ' ') fireQueue.push(selectedGun)
  if (key === '0') throttle.value = '0'
})
addEventListener('keyup', event => held.delete(event.key.toLowerCase()))
addEventListener('blur', () => { held.clear(); world.input.dashRequested = false; fireQueue.length = 0; throttle.value = '0'; pointer = null })
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect()
  pointer = { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }
})
canvas.addEventListener('pointerleave', () => { pointer = null })
requestAnimationFrame(frame)
