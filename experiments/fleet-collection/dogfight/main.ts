import { createDogfight, stepDogfight, type Dogfight } from './model'
import { mountLineups, readLineups } from '../battle/lineup'
import { targetCamera, smoothCamera, type Camera } from './camera'
import '../battle/style.css'
const root=document.querySelector<HTMLElement>('#app')!
root.innerHTML=`<header><a href="/">← 实验室</a> · <a href="/experiments/fleet-collection/battle/">原舰队战斗</a><h1>机动弹道对照实验</h1><p>相同舰体属性、情报与伤害公式 · 高速穿插 · 弹道可躲避</p></header><section class="controls"><label>种子 <input id="seed" type="number" value="42" step="1"></label><button id="reset">应用并重置</button><button id="play">暂停</button><button id="step">推进 0.1 秒</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option></select></label><span id="status"></span></section><section class="fleet"><h2>双方编队</h2><p>双方各配置 1–6 艘；空位不出战。修改后点击“应用并重置”。</p><div id="lineup"></div></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="狗斗战场"></canvas><p class="hint">三角＝驱逐、菱形＝巡洋、方形＝战列、飞机＝航空、双圆＝潜航；虚线连线表示空间层，方框为地形。弹幕碰到任意敌方舰船后，进行 ACC/EVA 命中判定并消失。</p><div id="ships"></div></section><aside><h2>战斗记录</h2><div id="events"></div></aside></div>`
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
mountLineups(el('lineup'), true)
const canvas=el<HTMLCanvasElement>('field'),ctx=canvas.getContext('2d')!
let battle:Dogfight=createDogfight(42),running=false,timer:number|undefined
let previousBattle: Dogfight = battle
let lastStepAt = performance.now()
let camera: Camera = targetCamera(battle.ships, canvas.width, canvas.height)!
let lastFrame = performance.now()
function drawScene(now: number) {
  // Render between fixed simulation snapshots; rendering never changes combat results.
  const interval = 100 / Number(el<HTMLSelectElement>('speed').value)
  const alpha = running ? Math.max(0, Math.min(1, (now - lastStepAt) / interval)) : 1
  const previousShips = new Map(previousBattle.ships.map(s => [s.id, s]))
  const displayShips = battle.ships.map(s => { const p = previousShips.get(s.id) ?? s; return { ...s, x: p.x + (s.x - p.x) * alpha, y: p.y + (s.y - p.y) * alpha } })
  const target = targetCamera(displayShips.filter(s => s.hp > 0), canvas.width, canvas.height)
  if (target) camera = smoothCamera(camera, target, (now - lastFrame) / 1000)
  lastFrame = now
  const point = (x: number, y: number) => ({ x: canvas.width / 2 + (x - camera.x) * camera.scale, y: canvas.height / 2 + (y - camera.y) * camera.scale })
  ctx.fillStyle = '#112635'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#234155'; ctx.lineWidth = 1
  const left = camera.x - canvas.width / (2 * camera.scale), right = camera.x + canvas.width / (2 * camera.scale)
  const top = camera.y - canvas.height / (2 * camera.scale), bottom = camera.y + canvas.height / (2 * camera.scale)
  for (let x = Math.floor(left / 20) * 20; x <= right; x += 20) { const p = point(x, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke() }
  for (let y = Math.floor(top / 20) * 20; y <= bottom; y += 20) { const p = point(0, y); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(canvas.width, p.y); ctx.stroke() }
  for (const box of battle.terrain) { const p = point(box.x, box.y); ctx.fillStyle = '#536657'; ctx.strokeStyle = '#a4bda3'; ctx.lineWidth = 2; ctx.fillRect(p.x, p.y, box.width * camera.scale, box.height * camera.scale); ctx.strokeRect(p.x, p.y, box.width * camera.scale, box.height * camera.scale); ctx.fillStyle = '#e0e9dc'; ctx.font = '12px sans-serif'; ctx.fillText('地形', p.x + 4, p.y + 14) }
  const previousProjectiles = new Map(previousBattle.projectiles.map(p => [p.id, p]))
  for (const p of battle.projectiles) { const old = previousProjectiles.get(p.id) ?? p; const x = old.x + (p.x - old.x) * alpha, y = old.y + (p.y - old.y) * alpha; const head = point(x, y), tail = point(x - p.vx * .15, y - p.vy * .15); const offset = p.layer === 'air' ? -24 : p.layer === 'submerged' ? 20 : 0; head.y += offset; tail.y += offset; ctx.strokeStyle = p.team === 'blue' ? '#8afbf0' : '#ff9b83'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(tail.x, tail.y); ctx.stroke() }
  for (const s of displayShips.filter(s => s.hp > 0)) {
    const base = point(s.x, s.y), offset = s.layer === 'air' ? -24 : s.layer === 'submerged' ? 20 : 0, x = base.x, y = base.y + offset
    const color = s.team === 'blue' ? '#69d5d4' : '#f08b83'
    if (offset) { ctx.strokeStyle=color;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]) }
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath()
    if(s.shipClass==='destroyer'){ctx.moveTo(x,y-10);ctx.lineTo(x+8,y+8);ctx.lineTo(x-8,y+8);ctx.closePath();ctx.fill()}
    else if(s.shipClass==='cruiser'){ctx.moveTo(x,y-10);ctx.lineTo(x+9,y);ctx.lineTo(x,y+10);ctx.lineTo(x-9,y);ctx.closePath();ctx.fill()}
    else if(s.shipClass==='battleship'){ctx.fillRect(x-8,y-8,16,16)}
    else if(s.shipClass==='aircraft'){ctx.moveTo(x,y-11);ctx.lineTo(x+3,y-2);ctx.lineTo(x+10,y+3);ctx.lineTo(x+3,y+3);ctx.lineTo(x+2,y+9);ctx.lineTo(x-2,y+9);ctx.lineTo(x-3,y+3);ctx.lineTo(x-10,y+3);ctx.lineTo(x-3,y-2);ctx.closePath();ctx.fill()}
    else {ctx.ellipse(x,y,10,6,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(x,y,5,3,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`${s.name} · ${s.layer==='air'?'空中':s.layer==='submerged'?'水下':'海面'}`,x+13,y-5);ctx.fillText(`${Math.ceil(s.hp)}/${s.stats.hp}`,x+13,y+11)
  }
  requestAnimationFrame(drawScene)
}
function draw(){
el('status').textContent=`${battle.time.toFixed(1)} 秒 · ${battle.result?({blue:'蓝方获胜',red:'红方获胜',draw:'平局 / 超时'} as const)[battle.result]:'交战中'} · 发射 ${battle.shots} / 接触 ${battle.collisions} / 命中 ${battle.hits} / 未接触 ${battle.dodges}`
el('play').textContent=running?'暂停':battle.result?'战斗结束':'继续';el<HTMLButtonElement>('play').disabled=Boolean(battle.result);el<HTMLButtonElement>('step').disabled=running||Boolean(battle.result)
el('ships').innerHTML=battle.ships.map(s=>`<div>${s.team==='blue'?'🔹':'🔸'} ${s.name} · HP ${s.hp.toFixed(1)} / ${s.stats.hp} · 对方情报 ${Math.floor(battle.intel[s.team==='blue'?'red':'blue'][s.id]??0)}</div>`).join('');el('events').innerHTML=[...battle.events].reverse().map(e=>`<p>${e}</p>`).join('')||'<p>等待战斗事件。</p>'}
function stop(){running=false;if(timer!==undefined)clearInterval(timer);timer=undefined}
function step(){previousBattle=battle;battle=stepDogfight(battle);lastStepAt=performance.now();if(battle.result)stop();draw()}
function start(){if(running||battle.result)return;running=true;timer=window.setInterval(step,100/Number(el<HTMLSelectElement>('speed').value))}
el('reset').onclick=()=>{const seed=Number(el<HTMLInputElement>('seed').value);if(!Number.isSafeInteger(seed)){el('status').textContent='请输入整数种子';return}const fleets=readLineups();if(!fleets){el('status').textContent='双方都至少需要一艘舰船';return}stop();battle=createDogfight(seed,fleets.blue,fleets.red);previousBattle=battle;lastStepAt=performance.now();camera=targetCamera(battle.ships,canvas.width,canvas.height)!;start();draw()}
el('play').onclick=()=>{if(running)stop();else start();draw()};el('step').onclick=step;el<HTMLSelectElement>('speed').onchange=()=>{if(running){stop();start()}};start();draw();requestAnimationFrame(drawScene)
