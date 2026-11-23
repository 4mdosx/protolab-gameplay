import '../battle/style.css'
import { bindingLabel, createBindings } from './bindings'
import { createPilotInput } from './pilot-input'
import { spawnDummy, resetDummy } from './engine/dummy'
import { HANDLING, applyHandling, type HandlingId } from './handling'
import { createClock, advance, SIM_STEP } from './engine/clock'
import { createWorld, lockedTarget, manualShip, stepWorld } from './engine/world'
import { pointerThrustAngle, THROTTLE_POWER } from './systems/control'
import { STEP } from './systems/maneuver'
import { drawFrame } from './render/frame'
import { followCamera, screenToWorld } from './render/view'
import type { Camera } from './render/view'

const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `<header><a href="/">← 实验室</a><h1>低空战斗平台</h1><p>鼠标推进，${bindingLabel('stepUp')} / ${bindingLabel('stepLeft')} / ${bindingLabel('stepDown')} / ${bindingLabel('stepRight')} 四向 Step，${bindingLabel('toggleGear')} 切档，${bindingLabel('brake')} 按住制动，${bindingLabel('boost')} 按住满推，${bindingLabel('toggleTarget')} 预选目标，${bindingLabel('recenter')} 回正 / BD 定航向，${bindingLabel('fire')} 开火。${bindingLabel('selectPrimary')} / ${bindingLabel('selectSecondary')} 选炮，${bindingLabel('clearWeapon')} 返回驾驶。</p></header><section class="controls"><label>操控参数 <select id="handling"></select></label><label><input type="checkbox" id="dummy-fire">木桩射击</label><button id="reset-dummy">重置木桩</button><button id="play">暂停</button><button id="step">推进 0.1 秒</button><label>出力 <select id="throttle"><option value="1">1 · 10% 微调</option><option value="2">2 · 35% 巡航</option></select></label><label><input type="checkbox" id="reverse-control" checked>控制反向（朝鼠标加速）</label><label>能量 <meter id="energy" min="0" max="100" value="100"></meter><span id="energy-status"></span></label><span id="status"></span></section><p id="mode-hint" role="status" aria-live="polite" style="padding:12px;border:1px solid;border-radius:8px"></p><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="低空战斗平台战场"></canvas><p class="hint">镜头随实际速度平滑拉远（8 m/s 以下近景，60 m/s 达最远）。白线是速度，橙色尾焰表示喷口方向与出力，蓝色 HUD 航迹保留最近 2.5 秒的移动路径，绿色虚线为当前速度的 3 秒惯性路线（不计后续推力与碰撞），浅蓝色前后喷焰用于转向与角速度制动；无推进指令时靠惯性滑行并回能；BD 降低侧滑抑制，转向沿弧线进行。几何小人为机体，金色面罩指向船头；双腿与脚底尾焰指示喷口方向，身体倾斜与手臂后摆反映实际加速度，1 号为身侧单个浮游主炮，2 号为浮游副炮。红色船尾扇区为背部弱装甲提示（来自后方 ±45° 的炮弹伤害 ×1.5）。驱逐舰 2发×2波 / 巡洋舰 2发×3波 / 战列舰 3发扇形×3波；末波后装填 4/6/9 秒，炮弹碰撞半径 0.45/0.65/1 米。黄色扇形始终显示可用射界，选中时加亮，超出射界时炮停在边缘。低楼可穿过，高楼的金色虚线框会挡住船体。</p></section><aside><h2>这一拍</h2><div id="events"></div></aside></div>`

const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const status = document.querySelector<HTMLElement>('#status')!
const events = document.querySelector<HTMLElement>('#events')!
const play = document.querySelector<HTMLButtonElement>('#play')!
const world = createWorld(17)
const shipId = manualShip(world)!
const dummyId = spawnDummy(world, shipId)
const dummyFire = document.querySelector<HTMLInputElement>('#dummy-fire')!
dummyFire.onchange = () => { world.trainingDummies.get(dummyId)!.firing = dummyFire.checked }
document.querySelector<HTMLButtonElement>('#reset-dummy')!.onclick = () => { resetDummy(world, dummyId); paint() }
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
const input = world.input
const pilotInput = createPilotInput(input)
const throttle = document.querySelector<HTMLSelectElement>('#throttle')!
const reverseControl = document.querySelector<HTMLInputElement>('#reverse-control')!
throttle.onchange = () => { input.throttle = throttle.value === '2' ? 2 : 1 }

function pointerInWorld() {
  return pointer ? screenToWorld(camera, canvas.width, canvas.height, pointer.x, pointer.y) : null
}

function sampleInput() {
  if (world.ship.get(dummyId)!.hp <= 0) input.lockTarget = undefined
  input.reverseControl = reverseControl.checked
  input.aim = pointerInWorld()
}

const bindings = createBindings(action => {
  if (action === 'recenter') {
    pilotInput.press(action, {
      recenterHeading: pointerThrustAngle(body, pointerInWorld(), reverseControl.checked),
    })
  } else if (action === 'toggleTarget') {
    pilotInput.press(action, { target: world.ship.get(dummyId)!.hp > 0 ? dummyId : undefined })
  } else {
    pilotInput.press(action)
  }
  throttle.value = String(input.throttle)
}, pilotInput.release)

function paint(seconds = 1 / 60) {
  const selectedGun = input.selectedGun ?? 0
  const command = world.command.get(shipId)
  const bd = !!command?.bd
  const preselected = !!lockedTarget(world, shipId)
  const weaponMode = !bd && selectedGun !== 0
  canvas.style.cursor = weaponMode ? 'crosshair' : 'move'
  canvas.style.outline = `2px solid ${weaponMode ? '#ffda80' : '#69d5d4'}`
  const hint = document.querySelector<HTMLElement>('#mode-hint')!
  hint.style.color = weaponMode ? '#ffda80' : '#69d5d4'
  const modeHint = bd ? `锁定 BD｜${world.pilot.get(shipId)?.bdCourse === undefined ? command?.brakeFraction !== undefined ? '绕障制动' : command?.avoidingObstacle ? '正在绕障' : '鼠标给航向' : '航向已快照'} · 左键更新航向 · 船头和炮塔追踪目标 · 松开 ${bindingLabel('boost')} 退出`
    : weaponMode ? `武器模式 · ${selectedGun} 号炮｜鼠标瞄准 · 推进方向保持 · ${bindingLabel('fire')} 单炮开火`
    : `驾驶模式｜鼠标推进 · ${bindingLabel('fire')} 齐射`
  hint.textContent = `${modeHint}${preselected && !bd ? ' · 已预选木桩' : ''}`

  const energy = world.energy.get(shipId)!
  document.querySelector<HTMLMeterElement>('#energy')!.value = energy.value
  const maneuver = command?.step ? 'Step 中' : bd ? '锁定 BD 中' : command?.fullThrust ? '满推中'
    : input.brake ? '制动' : world.pilot.get(shipId)?.recenterAngle !== undefined ? '回正中' : '常规推进'
  document.querySelector<HTMLElement>('#energy-status')!.textContent =
    ` ${energy.value.toFixed(0)}/100 · ${maneuver} · Step 需 ${STEP.cost}${energy.locked ? ' · 推进储备恢复中' : ''}${energy.feedback ? ' · ' + energy.feedback : ''}`
  const current = world.body.get(shipId)!
  const velocity = world.motion.get(shipId)!.velocity
  camera = followCamera(camera, current, seconds, Math.hypot(velocity.x, velocity.y))
  drawFrame(ctx, world, camera, shipId, alpha)
  const motion = world.motion.get(shipId)!
  const gun = world.drones.get(shipId)?.[selectedGun - 1]
  const speed = Math.hypot(motion.velocity.x, motion.velocity.y)
  status.textContent = `${world.time.toFixed(1)} 秒 · ${world.ship.get(shipId)!.name} · ${current.x.toFixed(0)}, ${current.y.toFixed(0)} · HP ${world.ship.get(shipId)!.hp.toFixed(0)} · 速度 ${speed.toFixed(1)} · ${gun ? gun.name + (gun.dead ? '：目标在死区' : '：目标在射界内') : '未选炮'}`
  play.textContent = running ? '暂停' : '继续'
  events.innerHTML = `<p>${HANDLING[handling.value as HandlingId].label} · 满推加速度 ${(motion.thrust / motion.mass).toFixed(1)} m/s² · 最大转速 ${(motion.maxTurnRate * 180 / Math.PI).toFixed(0)}°/s</p><p>质量 ${motion.mass} t · 推力 ${(motion.thrust * (command?.step?.power ?? command?.power ?? 0)).toFixed(0)} kN</p><p>本档沿船头平衡速度（非限速） ${Math.sqrt(motion.thrust * THROTTLE_POWER[input.throttle] / motion.drag).toFixed(1)} m/s</p><p>后坐力：${(world.recoil.get(shipId)?.length ?? 0) > 0 ? "作用中" : "无"}（每波反向推力，可与推进力抵消）</p><p>船头 ${(current.heading * 180 / Math.PI).toFixed(0)}°</p><p>浮游炮：${selectedGun ? selectedGun + " 号设置朝向" : "未选中"} · 转速 60°/s · 左右各向外偏 30° · 半射界 40° · 前方重叠 20°</p><p>${weaponMode ? '喷口方向锁定；退出武器模式后恢复鼠标驾驶' : pointer ? '鼠标控制喷口方向' : '鼠标离开战场，停止施力'}</p>`
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
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target instanceof HTMLElement &&
      event.target.closest('select, textarea, [contenteditable="true"]')) return
  if (event.code === 'Space' && event.target instanceof HTMLElement &&
      event.target.closest('button:focus-visible, input:focus-visible, a:focus-visible')) return
  if (bindings.keyDown(event.code, event.repeat)) event.preventDefault()
})
addEventListener('keyup', event => bindings.keyUp(event.code))
addEventListener('blur', () => {
  bindings.reset()
  pilotInput.reset()
  pointer = null
})

function updatePointer(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  pointer = {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  }
}

canvas.addEventListener('pointermove', updatePointer)
canvas.addEventListener('mousedown', event => {
  updatePointer(event)
  if (bindings.pointerDown(event.button)) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    event.preventDefault()
  }
})
canvas.addEventListener('pointerleave', () => { pointer = null })
requestAnimationFrame(frame)
