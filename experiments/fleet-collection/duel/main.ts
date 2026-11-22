import '../battle/style.css'
import { createDuel, stepDuel } from './step'
import { drawDuel, frameCamera } from './draw'
import type { Duel } from './types'

const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `<header><a href="/">← 实验室</a><h1>1v1 机动与开火</h1><p>只有两艘驱逐。扇形是主炮射界，白线是速度，船头是机体朝向。</p></header><section class="controls"><button id="play">暂停</button><button id="step">推进 0.1 秒</button><button id="reset">重置</button><span id="status"></span></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="1v1 战场"></canvas><p class="hint">射界是世界坐标里船头前方 ±60°、38 距离。画面纵向有压缩，所以扇形看起来比正圆瘦。弹从船中心沿目标方向发出，只有目标落在扇形内才会开火。</p></section><aside><h2>记录</h2><div id="events"></div></aside></div>`

const canvas = document.querySelector<HTMLCanvasElement>('#field')!
const ctx = canvas.getContext('2d')!
const status = document.querySelector<HTMLElement>('#status')!
const events = document.querySelector<HTMLElement>('#events')!
const play = document.querySelector<HTMLButtonElement>('#play')!
let duel: Duel = createDuel()
let running = true
let timer = window.setInterval(tick, 100)

function render() {
  const living = duel.hulls.filter(ship => ship.hp > 0)
  const camera = frameCamera(living.length ? living : duel.hulls, canvas.width, canvas.height)
  drawDuel(ctx, duel, camera)
  const done = living.length < 2
  status.textContent = `${duel.time.toFixed(1)} 秒 · ${done ? '战斗结束' : '交战中'} · 蓝 ${duel.hulls[0].hp.toFixed(0)} / 红 ${duel.hulls[1].hp.toFixed(0)}`
  play.textContent = running ? '暂停' : done ? '战斗结束' : '继续'
  play.disabled = done
  events.innerHTML = [...duel.log].reverse().map(line => `<p>${line}</p>`).join('') || '<p>等待开火。</p>'
}

function tick() {
  duel = stepDuel(duel)
  if (duel.hulls.filter(ship => ship.hp > 0).length < 2) { running = false; clearInterval(timer) }
  render()
}

play.onclick = () => {
  if (play.disabled) return
  running = !running
  if (running) timer = window.setInterval(tick, 100)
  else clearInterval(timer)
  render()
}
document.querySelector<HTMLButtonElement>('#step')!.onclick = () => { if (running) return; tick() }
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
  clearInterval(timer)
  duel = createDuel()
  running = true
  timer = window.setInterval(tick, 100)
  render()
}
render()
