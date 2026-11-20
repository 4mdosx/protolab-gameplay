import { createDogfight, stepDogfight, type Dogfight } from './model'
import { mountLineups, readLineups } from '../battle/lineup'
import { targetCamera, smoothCamera, type Camera } from './camera'
import { coastY, riverX } from './city'
import '../battle/style.css'
const openSea = new URLSearchParams(location.search).get('mode') === 'sea'
const root=document.querySelector<HTMLElement>('#app')!
root.innerHTML=`<header><a href="/">← 实验室</a> · <a href="/experiments/fleet-collection/battle/">原舰队战斗</a><h1>舰队狗斗实验</h1><p>相同舰体属性、情报与伤害公式 · 高速穿插 · 弹道可躲避</p></header><section class="controls"><span class="seed-control"><label>战斗种子 <input id="seed" type="number" value="42" step="1"></label><button type="button" id="random-seed" aria-label="随机生成战斗种子">随机</button></span><span class="seed-control" id="map-seed-control"><label>地图种子 <input id="map-seed" type="number" value="17" step="1"></label><button type="button" id="random-map-seed" aria-label="随机生成地图种子">随机</button></span><button id="reset">应用并重置</button><button id="play">暂停</button><button id="step">推进 0.1 秒</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option></select></label><span id="status"></span></section><section class="fleet"><h2>双方编队</h2><p>双方各配置 1–6 艘；空位不出战。修改后点击“应用并重置”。</p><div id="lineup"></div></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="狗斗战场"></canvas><p class="hint">三角＝驱逐、菱形＝巡洋、方形＝战列、飞机＝航空、双圆＝潜航；虚线连线表示空间层，低楼可穿越；高楼阻挡飞行和弹幕。金色虚线框是高楼地面碰撞范围，短尾线表示航向。弹幕碰到任意敌方舰船后，进行 ACC/EVA 命中判定并消失。</p><div id="ships"></div></section><aside><h2>战斗记录</h2><div id="events"></div></aside></div>`
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
if (openSea) { document.querySelector('h1')!.textContent = '开放海面战斗'; el('map-seed-control').hidden = true }
mountLineups(el('lineup'), true)
const canvas=el<HTMLCanvasElement>('field'),ctx=canvas.getContext('2d')!
let battle:Dogfight=createDogfight(42, [0,1,2], [0,1,2], 17, openSea),running=false,timer:number|undefined
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
  const point = (x: number, y: number) => ({ x: canvas.width / 2 + (x - camera.x) * camera.scale, y: canvas.height / 2 + (y - camera.y) * camera.scale * 0.78 })
  ctx.fillStyle = '#112635'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  // Render the same continuous coastline used by generation; land is south of the line.
  const viewLeft = camera.x - canvas.width / (2 * camera.scale), viewRight = camera.x + canvas.width / (2 * camera.scale)
  const coastStep = Math.max(10, (viewRight-viewLeft)/200)
  const coast = []
  for (let x = viewLeft; x < viewRight; x += coastStep) coast.push(point(x, coastY(battle.city.seed, x)))
  coast.push(point(viewRight, coastY(battle.city.seed, viewRight)))
  if (!openSea) { ctx.fillStyle = '#273e3b'; ctx.beginPath(); ctx.moveTo(coast[0].x, canvas.height); for (const p of coast) ctx.lineTo(p.x, p.y); ctx.lineTo(coast[coast.length-1].x, canvas.height); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#8aab93'; ctx.lineWidth = 3; ctx.beginPath(); coast.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.stroke() }
  // Draw connected river channels and lakes; roads are a global grid with bridges over water.
  const worldTop = camera.y - canvas.height / (2 * camera.scale * 0.78), worldBottom = camera.y + canvas.height / (2 * camera.scale * 0.78)
  for(let river=0;!openSea && river<2;river++){
    ctx.strokeStyle='#214b60';ctx.lineWidth=10*camera.scale;ctx.beginPath()
    for(let i=0;i<=100;i++){const y=worldTop+(worldBottom-worldTop)*i/100,x=riverX(battle.city.seed,river,y),p=point(x,y);if(y>=coastY(battle.city.seed,x)){if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)}else ctx.moveTo(p.x,p.y)}ctx.stroke()
    const first=Math.ceil((worldTop-100-river*60)/320),last=Math.floor((worldBottom-100-river*60)/320)
    for(let k=first;k<=last && k<first+100;k++){const y=100+river*60+k*320,x=riverX(battle.city.seed,river,y);if(y<coastY(battle.city.seed,x))continue;const p=point(x,y);ctx.fillStyle='#214b60';ctx.beginPath();ctx.ellipse(p.x,p.y,16*camera.scale,12*camera.scale*0.78,0,0,Math.PI*2);ctx.fill()}
  }
  ctx.strokeStyle = '#405151'; ctx.lineWidth = Math.max(1, 2 * camera.scale)
  const left = camera.x - canvas.width / (2 * camera.scale), right = camera.x + canvas.width / (2 * camera.scale)
  const top = camera.y - canvas.height / (2 * camera.scale * 0.78), bottom = camera.y + canvas.height / (2 * camera.scale * 0.78)
  if (!openSea) for (let x = Math.floor(left / 30) * 30; x <= right; x += 30) { const p = point(x, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, canvas.height); ctx.stroke() }
  if (!openSea) for (let y = Math.floor(top / 30) * 30; y <= bottom; y += 30) { const p = point(0, y); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(canvas.width, p.y); ctx.stroke() }
  // Ground footprint is the actual collision area. Drawing uses the same coordinates.
  const drawBuilding = (box: typeof battle.terrain[number]) => {
    if (box.x + box.width < left || box.x > right || box.y + box.height < top-50 || box.y > bottom+50) return
    const p=point(box.x,box.y),w=box.width*camera.scale,h=box.height*camera.scale*.78
    const elevation=(box.elevation??5)*camera.scale*.7,tower=box.kind==='tower'
    if(tower){ctx.strokeStyle='#e6bd69';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeRect(p.x,p.y,w,h);ctx.setLineDash([])}
    ctx.fillStyle=tower?'#3b4f56':'#334b48';ctx.fillRect(p.x,p.y+h-elevation,w,elevation)
    ctx.fillStyle=tower?'#78999c':'#58716a';ctx.fillRect(p.x,p.y-elevation,w,h)
    ctx.strokeStyle=tower?'#b8e2dc':'#66817a';ctx.lineWidth=tower?2:1;ctx.strokeRect(p.x,p.y-elevation,w,h)
    if(tower && w>22 && h>20){ctx.fillStyle='#eaf8ee';ctx.font='11px sans-serif';ctx.fillText('高楼',p.x+3,p.y-elevation+13)}
  }
  for(const box of battle.terrain.filter(b=>b.kind!=='tower')) drawBuilding(box)
  const previousProjectiles = new Map(previousBattle.projectiles.map(p => [p.id, p]))
  for (const p of battle.projectiles) { const old = previousProjectiles.get(p.id) ?? p; const x = old.x + (p.x - old.x) * alpha, y = old.y + (p.y - old.y) * alpha; const head = point(x, y), tail = point(x - p.vx * .15, y - p.vy * .15); const offset = p.layer === 'air' ? -24 : p.layer === 'submerged' ? 20 : 0; head.y += offset; tail.y += offset; ctx.strokeStyle = p.team === 'blue' ? '#8afbf0' : '#ff9b83'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(tail.x, tail.y); ctx.stroke() }
  const drawShip = (s: typeof displayShips[number]) => {
    const base = point(s.x, s.y), offset = s.layer === 'air' ? -24 : s.layer === 'submerged' ? 20 : 0, x = base.x, y = base.y + offset
    const color = s.team === 'blue' ? '#69d5d4' : '#f08b83'
    const orbit=battle.orbits[s.id]
    if(orbit){const o=point(orbit.x,orbit.y);ctx.strokeStyle=s.team==='blue'?'#69d5d480':'#f08b8380';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(o.x,o.y);ctx.stroke();ctx.setLineDash([])}
    const heading=battle.headings[s.id]
    if(heading!==undefined){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-Math.cos(heading)*17,y-Math.sin(heading)*13);ctx.lineTo(x-Math.cos(heading)*9,y-Math.sin(heading)*7);ctx.stroke()}
    if (offset) { ctx.strokeStyle=color;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]) }
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath()
    if(s.shipClass==='destroyer'){ctx.moveTo(x,y-10);ctx.lineTo(x+8,y+8);ctx.lineTo(x-8,y+8);ctx.closePath();ctx.fill()}
    else if(s.shipClass==='cruiser'){ctx.moveTo(x,y-10);ctx.lineTo(x+9,y);ctx.lineTo(x,y+10);ctx.lineTo(x-9,y);ctx.closePath();ctx.fill()}
    else if(s.shipClass==='battleship'){ctx.fillRect(x-8,y-8,16,16)}
    else if(s.shipClass==='aircraft'){ctx.moveTo(x,y-11);ctx.lineTo(x+3,y-2);ctx.lineTo(x+10,y+3);ctx.lineTo(x+3,y+3);ctx.lineTo(x+2,y+9);ctx.lineTo(x-2,y+9);ctx.lineTo(x-3,y+3);ctx.lineTo(x-10,y+3);ctx.lineTo(x-3,y-2);ctx.closePath();ctx.fill()}
    else {ctx.ellipse(x,y,10,6,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(x,y,5,3,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`${s.name} · ${s.layer==='air'?'空中':s.layer==='submerged'?'水下':'海面'}`,x+13,y-5);ctx.fillText(`${Math.ceil(s.hp)}/${s.stats.hp}`,x+13,y+11)
  }
  // Back-to-front ordering makes a unit behind a tower disappear behind its facade.
  const depthItems = [
    ...battle.terrain.filter(box=>box.kind==='tower').map(box=>({depth:box.y+box.height,box,ship:null})),
    ...displayShips.filter(ship=>ship.hp>0).map(ship=>({depth:ship.y,box:null,ship})),
  ].sort((a,b)=>a.depth-b.depth)
  for(const item of depthItems) { if(item.box) drawBuilding(item.box); else if(item.ship) drawShip(item.ship) }

  requestAnimationFrame(drawScene)
}
function draw(){
el('status').textContent=`${battle.time.toFixed(1)} 秒 · ${battle.result?({blue:'蓝方获胜',red:'红方获胜',draw:'平局 / 超时'} as const)[battle.result]:'交战中'} · 发射 ${battle.shots} / 接触 ${battle.collisions} / 命中 ${battle.hits} / 未接触 ${battle.dodges}`
el('play').textContent=running?'暂停':battle.result?'战斗结束':'继续';el<HTMLButtonElement>('play').disabled=Boolean(battle.result);el<HTMLButtonElement>('step').disabled=running||Boolean(battle.result)
el('ships').innerHTML=battle.ships.map(s=>`<div>${s.team==='blue'?'🔹':'🔸'} ${s.name} · HP ${s.hp.toFixed(1)} / ${s.stats.hp} · ${({'search':'搜索','cover':'冷却找掩体','attack':'就绪进攻','evade':'脱离'} as const)[battle.tactics[s.id] ?? 'search']} · 对方情报 ${Math.floor(battle.intel[s.team==='blue'?'red':'blue'][s.id]??0)}</div>`).join('');el('events').innerHTML=[...battle.events].reverse().map(e=>`<p>${e}</p>`).join('')||'<p>等待战斗事件。</p>'}
function stop(){running=false;if(timer!==undefined)clearInterval(timer);timer=undefined}
function step(){previousBattle=battle;battle=stepDogfight(battle);lastStepAt=performance.now();if(battle.result)stop();draw()}
function start(){if(running||battle.result)return;running=true;timer=window.setInterval(step,100/Number(el<HTMLSelectElement>('speed').value))}
el('reset').onclick=()=>{const seed=Number(el<HTMLInputElement>('seed').value);if(!Number.isSafeInteger(seed)){el('status').textContent='请输入整数种子';return}const mapSeed=Number(el<HTMLInputElement>('map-seed').value);if(!Number.isSafeInteger(mapSeed)){el('status').textContent='请输入整数地图种子';return}const fleets=readLineups();if(!fleets){el('status').textContent='双方都至少需要一艘舰船';return}stop();battle=createDogfight(seed,fleets.blue,fleets.red,mapSeed,openSea);previousBattle=battle;lastStepAt=performance.now();camera=targetCamera(battle.ships,canvas.width,canvas.height)!;start();draw()}
function randomizeSeed(id: string) {
  const input = el<HTMLInputElement>(id)
  const previous = Number(input.value) >>> 0
  const value = crypto.getRandomValues(new Uint32Array(1))[0]
  input.value = String(value === previous ? (value + 1) >>> 0 : value)
  el('status').textContent = '种子已更新，点击“应用并重置”开始新战斗'
}
el('random-seed').onclick = () => randomizeSeed('seed')
el('random-map-seed').onclick = () => randomizeSeed('map-seed')
el('play').onclick=()=>{if(running)stop();else start();draw()};el('step').onclick=step;el<HTMLSelectElement>('speed').onchange=()=>{if(running){stop();start()}};start();draw();requestAnimationFrame(drawScene)
