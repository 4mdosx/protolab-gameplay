import { createBattle, stepBattle, type Battle } from './model'
import './style.css'
import { mountLineups, readLineups } from './lineup'
const root = document.querySelector<HTMLElement>('#app')!
root.innerHTML = `<header><a href="/">← Gameplay Lab</a><h1>舰队单场战斗</h1><p>二维空间 · 共享情报 · 固定舰装 · 自动行动</p></header><section class="controls"><label>随机种子 <input id="seed" type="number" value="42" step="1"></label><button id="reset">应用编队并重置</button><button id="step">推进 1 秒</button><button id="play">暂停</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option></select></label><span id="status"></span></section><section class="fleet"><h2>双方编队</h2><p>双方各配置 1–6 艘；空位不出战。修改后点击“应用编队并重置”。</p><div id="lineup"></div></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="二维舰队战场"></canvas><p class="hint">圆点为舰船；虚线为蓝方武器射程。双方编队可调整。</p><div id="ships"></div></section><aside><h2>战斗记录</h2><div id="events"></div></aside></div>`
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const canvas = get<HTMLCanvasElement>('field'), ctx = canvas.getContext('2d')!
mountLineups(get('lineup'))
let battle: Battle = createBattle(42), running = false, timer: number | undefined
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#112635'; ctx.fillRect(0, 0, 960, 600)
  ctx.strokeStyle = '#234155'; for (let x = 0; x <= 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke() }
  for (const s of battle.ships.filter(s => s.hp > 0)) {
    const x = s.x * 8, y = s.y * 6
    if (s.team === 'blue') { ctx.beginPath(); ctx.setLineDash([5, 8]); ctx.strokeStyle = '#3b6474'; ctx.ellipse(x, y, s.weapon.range * 8, s.weapon.range * 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]) }
    ctx.fillStyle = s.team === 'blue' ? '#69d5d4' : '#f08b83'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(s.name, x + 13, y - 5); ctx.fillText(`${Math.ceil(s.hp)}/${s.stats.hp}`, x + 13, y + 11)
  }
  get('status').textContent = `${battle.time} 秒 · ${battle.result ? ({ blue: '蓝方获胜', red: '红方获胜', draw: '平局 / 超时' } as const)[battle.result] : '交战中'}`
  get('play').textContent = running ? '暂停' : battle.result ? '战斗结束' : '继续'
  get<HTMLButtonElement>('play').disabled = Boolean(battle.result)
  get<HTMLButtonElement>('step').disabled = running || Boolean(battle.result)
  get('ships').innerHTML = battle.ships.map(s => `<div>${s.team === 'blue' ? '🔹' : '🔸'} ${s.name} · HP ${s.hp.toFixed(1)} / ${s.stats.hp} · ${s.personality === 'kite' ? '保持距离' : '接近'} · ${s.weapon.id} · 对方情报 ${Math.floor(battle.intel[s.team === 'blue' ? 'red' : 'blue'][s.id] ?? 0)}</div>`).join('')
  get('events').innerHTML = [...battle.events].reverse().map(e => `<p>${e}</p>`).join('') || '<p>等待情报和战斗事件。</p>'
}
function stop() { running = false; if (timer !== undefined) clearInterval(timer); timer = undefined }
function step() { battle = stepBattle(battle); if (battle.result) stop(); draw() }
function start() { if (running || battle.result) return; running = true; timer = window.setInterval(step, 1000 / Number(get<HTMLSelectElement>('speed').value)) }
get('reset').onclick = () => { const seed = Number(get<HTMLInputElement>('seed').value); if (!Number.isSafeInteger(seed)) { get('status').textContent = '请输入整数种子'; return }; const fleets = readLineups(); if (!fleets) { get('status').textContent = '双方都至少需要一艘舰船'; return }; stop(); battle = createBattle(seed, fleets.blue, fleets.red); start(); draw() }
get('step').onclick = step
get<HTMLSelectElement>('speed').onchange = () => { if (running) { stop(); start() } }
get('play').onclick = () => { if (running) stop(); else start(); draw() }
start()
draw()
