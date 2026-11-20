import { idle, type Config, type State } from './model'
import { batch, createRandom, summarize } from '../../packages/simulation'
import { starterIncome, starterUpgradeCost } from '../../recipes/curves'
import { upgradeCost } from '../../packages/progression'
import { playSound } from '../../packages/assets'
import { downloadJSON } from '../../packages/inspector'
import './style.css'
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `<main><header><a href="/" style="color:#7edac8">← 返回实验室</a><p>GAMEPLAY LAB / EXPERIMENT 001</p><h1>Idle 经济循环</h1><p>调整收入与成本，观察升级节奏；批量模拟使用相同的自动升级策略。</p></header><section class="grid"><article><h2>参数</h2><label>初始收入 / 秒 <input id="income" type="number" min="0.01" step="0.1" value="1"></label><label>初始升级费用 <input id="cost" type="number" min="0.01" step="1" value="10"></label><label>费用增长倍率 <input id="rate" type="number" min="1" step="0.05" value="1.35"></label><label>双倍收益概率 <input id="chance" type="number" min="0" max="1" step="0.05" value="0.1"></label><label>随机种子 <input id="seed" type="number" step="1" value="42"></label><button id="reset">应用参数并重置</button><p class="hint">模拟每秒推进一次，与画面刷新率分离。</p></article><article><h2>运行状态</h2><div id="stats"></div><div class="buttons"><button id="toggle">开始</button><button id="step">推进 1 秒</button><button id="upgrade">升级</button></div><label>速度 <select id="speed"><option value="1">1×</option><option value="10">10×</option><option value="100">100×</option></select></label><label><input id="auto" type="checkbox"> 自动升级</label><p id="message" class="hint"></p></article><article><h2>批量模拟</h2><p>100 个连续种子，各模拟 300 秒并自动升级。</p><button id="batch">运行对照</button><button id="export">导出记录 JSON</button><div id="result" class="hint">尚未运行。</div></article></section><footer>程序化占位资产 · 参数为实验配方，并非平衡结论</footer></main>`
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const input = (id: string) => Number(el<HTMLInputElement>(id).value)
let config: Config = { cost: starterUpgradeCost, income: starterIncome, bonusChance: 0.1 },
  seed = 42
let state: State = idle.initialState(config),
  random = createRandom(seed),
  running = false,
  tick = 0,
  last = performance.now(),
  accumulated = 0
let batchResult: ReturnType<typeof batch<State, 'auto', Config>> | null = null
function draw() {
  el('stats').innerHTML =
    `<div class="stat"><span>等级</span><strong>${state.level}</strong></div><div class="stat"><span>资源</span><strong>${state.resources.toFixed(1)}</strong></div><div class="stat"><span>下一次升级</span><strong>${upgradeCost(config.cost, state.level).toFixed(1)}</strong></div><div class="stat"><span>模拟时间</span><strong>${state.elapsed} 秒</strong></div>`
  el('toggle').textContent = running ? '暂停' : '开始'
}
function advance(action: 'wait' | 'upgrade' | 'auto') {
  const before = state.level
  state = idle.step(state, action, { random, tick: tick++, delta: 1 })
  if (action === 'upgrade' && before === state.level)
    el('message').textContent = '资源不足；时间已推进 1 秒。'
  else el('message').textContent = ''
  draw()
}
el('reset').onclick = () => {
  const income = input('income'),
    cost = input('cost'),
    rate = input('rate'),
    chance = input('chance'),
    nextSeed = input('seed')
  if (
    ![income, cost, rate, chance, nextSeed].every(Number.isFinite) ||
    income <= 0 ||
    cost <= 0 ||
    rate < 1 ||
    chance < 0 ||
    chance > 1 ||
    !Number.isInteger(nextSeed)
  ) {
    el('message').textContent =
      '请检查参数：收入、费用须大于 0，倍率不小于 1，概率为 0–1，种子为整数。'
    return
  }
  config = {
    cost: { type: 'exponential', base: cost, rate },
    income: { type: 'linear', base: income, slope: 0.75 },
    bonusChance: chance,
  }
  seed = nextSeed
  state = idle.initialState(config)
  random = createRandom(seed)
  tick = 0
  running = false
  accumulated = 0
  batchResult = null
  el('result').textContent = '参数已更新，请重新运行批量模拟。'
  el('message').textContent = ''
  draw()
}
el('toggle').onclick = () => {
  running = !running
  last = performance.now()
  draw()
  playSound('ui.click')
}
el('step').onclick = () => advance(el<HTMLInputElement>('auto').checked ? 'auto' : 'wait')
el('upgrade').onclick = () => {
  advance('upgrade')
  playSound('ui.confirm')
}
el('batch').onclick = () => {
  batchResult = batch(
    idle,
    config,
    Array.from({ length: 100 }, (_, i) => seed + i),
    300,
    1,
    () => 'auto',
  )
  const levels = summarize(batchResult.map((r) => r.metrics.level))
  el('result').textContent =
    `300 秒后等级：平均 ${levels.mean.toFixed(2)}，中位数 ${levels.median}，范围 ${levels.min}–${levels.max}。`
}
el('export').onclick = () =>
  downloadJSON('idle-experiment.json', {
    schemaVersion: 1,
    experiment: idle.id,
    codeVersion: '未记录，请填写 Git commit',
    exportedAt: new Date().toISOString(),
    config,
    seed,
    tick,
    state,
    batch: batchResult && { ticks: 300, delta: 1, policy: 'auto', results: batchResult },
  })
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1)
  last = now
  if (running) {
    accumulated += dt * Number(el<HTMLSelectElement>('speed').value)
    while (accumulated >= 1) {
      advance(el<HTMLInputElement>('auto').checked ? 'auto' : 'wait')
      accumulated--
    }
  }
  requestAnimationFrame(frame)
}
draw()
requestAnimationFrame(frame)
