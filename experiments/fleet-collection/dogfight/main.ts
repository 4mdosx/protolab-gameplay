import { createDogfight, stepDogfight, type Dogfight } from './model'
import { mountLineups, readLineups } from '../battle/lineup'
import { focusCamera, targetCamera, smoothCamera, type Camera } from './camera'
import { flightPoint } from './projection'
import { defaults, readStore, writeStore, validForBattle, lineupIndices, type BattleSettings, type Scene } from './settings'
import { characters } from '../config'
import { coastY, riverX } from './city'
import '../battle/style.css'
const openSea = new URLSearchParams(location.search).get('mode') === 'sea'
const root=document.querySelector<HTMLElement>('#app')!
root.innerHTML=`<header><a href="/">← 实验室</a> · <a href="/experiments/fleet-collection/battle/">原舰队战斗</a><h1>舰灵狗斗实验</h1><p>相同舰体属性、情报与伤害公式 · 高速穿插 · 弹道可躲避</p></header><section class="controls"><span class="seed-control"><label>战斗种子 <input id="seed" type="number" value="42" step="1"></label><button type="button" id="random-seed" aria-label="随机生成战斗种子">随机</button></span><span class="seed-control" id="map-seed-control"><label>地图种子 <input id="map-seed" type="number" value="17" step="1"></label><button type="button" id="random-map-seed" aria-label="随机生成地图种子">随机</button></span><button id="reset">应用并重置</button><button id="play">暂停</button><button id="step">推进 0.1 秒</button><label>速度 <select id="speed"><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option></select></label><span id="status"></span></section><section class="fleet"><h2>双方编队</h2><p>双方各配置 1–6 艘；空位不出战。航母通过召唤舰载机作战。修改后点击“应用并重置”。</p><div id="lineup"></div><div class="presets"><label>预设名称 <input id="preset-name" type="text" maxlength="40" placeholder="例如：航母护卫"></label><button type="button" id="save-preset">保存预设</button><label>已保存 <select id="preset-list"><option value="">选择预设</option></select></label><button type="button" id="load-preset">加载</button><button type="button" id="delete-preset">删除</button><span id="settings-message" role="status"></span></div><p class="hint">设置和预设仅保存在当前浏览器标签页的会话中；海面和城市各自保存。</p></section><div class="layout"><section><canvas id="field" width="960" height="600" aria-label="狗斗战场"></canvas><p class="hint">三角＝驱逐、菱形＝巡洋、方形＝战列、飞机＝航母、双圆＝潜航；虚线连线表示空间层，低楼可穿越；高楼阻挡飞行和弹幕。金色虚线框是高楼地面碰撞范围；被高楼立面挡住的舰娘会留下同色轮廓和名字。角色和弹幕整体上移表示低空飞行，阴影表示计算位置。弹幕碰到任意敌方舰船后，进行 ACC/EVA 命中判定并消失。点击列表或战场中的单位进入聚焦：画面中心取该单位与其当前目标的中点，并按双方距离缩放；再次点击回到全场。</p><div id="ships"></div></section><aside><h2>战斗记录</h2><div id="events"></div></aside></div>`
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
if (openSea) { document.querySelector('h1')!.textContent = '开放海面战斗'; el('map-seed-control').hidden = true }
mountLineups(el('lineup'), true)
const scene: Scene = openSea ? 'sea' : 'city'
let store = readStore(sessionStorage)
let stored = store.scenes[scene] ?? { presets: [] }
store.scenes[scene] = stored
function applySettings(settings: BattleSettings) {
  for (const team of ['blue','red'] as const) settings[team].forEach((id,i)=> { el<HTMLSelectElement>(`${team}-slot-${i}`).value = id === null ? '' : String(characters.findIndex(c=>c.id===id)) })
  el<HTMLInputElement>('seed').value=settings.seed;el<HTMLInputElement>('map-seed').value=settings.mapSeed;el<HTMLSelectElement>('speed').value=settings.speed
}
function captureSettings(): BattleSettings {
  const slots=(team:'blue'|'red')=>Array.from({length:6},(_,i)=>{const value=el<HTMLSelectElement>(`${team}-slot-${i}`).value;return value===''?null:characters[Number(value)]?.id??null})
  return {blue:slots('blue'),red:slots('red'),seed:el<HTMLInputElement>('seed').value,mapSeed:el<HTMLInputElement>('map-seed').value,speed:el<HTMLSelectElement>('speed').value}
}
function persistCurrent(): boolean {
  stored.current=captureSettings()
  if (!writeStore(sessionStorage,store)) { el('settings-message').textContent='无法保存到当前会话，设置可能丢失'; return false }
  return true
}
function refreshPresets(selected='') {
  const list=el<HTMLSelectElement>('preset-list');list.replaceChildren(new Option('选择预设',''))
  stored.presets.forEach((preset,index)=>list.add(new Option(preset.name,String(index))))
  list.value=selected
}
applySettings(stored.current ?? defaults())
refreshPresets()
const initialSettings = captureSettings()
const initialValid = validForBattle(initialSettings)
const startSettings = initialValid ? initialSettings : defaults()
const canvas=el<HTMLCanvasElement>('field'),ctx=canvas.getContext('2d')!
let battle:Dogfight=createDogfight(Number(startSettings.seed), lineupIndices(startSettings.blue), lineupIndices(startSettings.red), Number(startSettings.mapSeed), openSea),running=false,timer:number|undefined
let previousBattle: Dogfight = battle
let lastStepAt = performance.now()
let camera: Camera = targetCamera(battle.ships, canvas.width, canvas.height)!
let focusId: string | null = null
let screenPicks: { id: string; x: number; y: number }[] = []
let lastFrame = performance.now()
function drawScene(now: number) {
  try {
  // Render between fixed simulation snapshots; rendering never changes combat results.
  const interval = 100 / Number(el<HTMLSelectElement>('speed').value)
  const alpha = running ? Math.max(0, Math.min(1, (now - lastStepAt) / interval)) : 1
  const previousShips = new Map([...previousBattle.ships,...previousBattle.aircraft].map(s => [s.id, s]))
  const displayShips = [...battle.ships,...battle.aircraft].map(s => { const p = previousShips.get(s.id) ?? s; return { ...s, x: p.x + (s.x - p.x) * alpha, y: p.y + (s.y - p.y) * alpha } })
  const focusSubject = focusId ? displayShips.find(s => s.id === focusId && s.hp > 0) : undefined
  const focusEngaged = focusSubject ? displayShips.find(s => s.id === battle.targets[focusSubject.id] && s.hp > 0) : undefined
  const desired = focusSubject ? focusCamera(focusSubject, focusEngaged ?? null, canvas.width, canvas.height) : targetCamera(displayShips.filter(s => s.hp > 0), canvas.width, canvas.height)
  if (desired) camera = smoothCamera(camera, desired, (now - lastFrame) / 1000)
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
  for (const p of battle.projectiles) { const old = previousProjectiles.get(p.id) ?? p; const x = old.x + (p.x - old.x) * alpha, y = old.y + (p.y - old.y) * alpha; const head = flightPoint(point(x, y), camera.scale), tail = flightPoint(point(x - p.vx * .15, y - p.vy * .15), camera.scale); ctx.strokeStyle = p.damage === 'underwater' ? (p.team === 'blue' ? '#f7dc75' : '#ffa648') : (p.team === 'blue' ? '#8afbf0' : '#ff9b83'); ctx.lineWidth = p.damage === 'underwater' ? 4 : 2; ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.lineTo(tail.x, tail.y); ctx.stroke() }
  const drawShip = (s: typeof displayShips[number]) => {
    const base = point(s.x, s.y), flying = flightPoint(base, camera.scale), x = flying.x, y = flying.y
    const color = s.team === 'blue' ? '#69d5d4' : '#f08b83'
    const orbit=battle.orbits[s.id]
    if(orbit){const o=flightPoint(point(orbit.x,orbit.y),camera.scale);ctx.strokeStyle=s.team==='blue'?'#69d5d480':'#f08b8380';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(o.x,o.y);ctx.stroke();ctx.setLineDash([])}
    const heading=battle.headings[s.id]
    if(s.shipClass==='destroyer' && !s.unitKind && heading!==undefined){
      const arc = s.weaponSlots[0]?.weapon.arc
      if(arc){ctx.strokeStyle=s.team==='blue'?'#69d5d455':'#f08b8355';ctx.lineWidth=1;ctx.beginPath();const nose=flightPoint(point(s.x,s.y),camera.scale);ctx.moveTo(nose.x,nose.y);for(let a=heading-arc;a<=heading+arc+0.001;a+=0.18){const p=flightPoint(point(s.x+Math.cos(a)*28,s.y+Math.sin(a)*28),camera.scale);ctx.lineTo(p.x,p.y)}ctx.stroke()}
      const face=battle.intentHeadings[s.id]
      if(face!==undefined){const tip=flightPoint(point(s.x+Math.cos(face)*26,s.y+Math.sin(face)*26),camera.scale);ctx.strokeStyle='#e6bd69';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.setLineDash([])}
      const velocity=battle.velocities[s.id]
      if(velocity){const tip=flightPoint(point(s.x+velocity.x*0.7,s.y+velocity.y*0.7),camera.scale);ctx.strokeStyle='#f4fff8';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tip.x,tip.y);ctx.stroke()}
    } else if(heading!==undefined){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-Math.cos(heading)*17,y-Math.sin(heading)*13);ctx.lineTo(x-Math.cos(heading)*9,y-Math.sin(heading)*7);ctx.stroke()}
    ctx.fillStyle = s.team === 'blue' ? '#69d5d455' : '#f08b8355'; ctx.beginPath(); ctx.ellipse(base.x,base.y,5,2.5,0,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=color;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([])
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2;paintHull(s, x, y, 'fill')
    ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(`${s.name} · ${s.layer==='air'?'空中':s.layer==='submerged'?'水下':'海面'}`,x+13,y-5);ctx.fillText(`${Math.ceil(s.hp)}/${s.stats.hp}`,x+13,y+11)
    screenPicks.push({ id: s.id, x, y })
    if (s.id === focusId || s.id === focusEngaged?.id) { ctx.strokeStyle = s.id === focusId ? '#f4fff8' : '#e6bd69'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s.id === focusId ? 18 : 15, 0, Math.PI * 2); ctx.stroke() }
  }
  // Towers still draw in front of ships behind them. A ship hidden by that facade keeps an outline.
  const paintHull = (s: typeof displayShips[number], x: number, y: number, mode: 'fill' | 'stroke') => {
    ctx.beginPath()
    if(s.unitKind==='aircraft'){ctx.moveTo(x,y-8);ctx.lineTo(x+7,y+7);ctx.lineTo(x,y+4);ctx.lineTo(x-7,y+7);ctx.closePath()}
    else if(s.shipClass==='destroyer'){const h=battle.headings[s.id]??-Math.PI/2,fx=Math.cos(h),fy=Math.sin(h)*0.78,fl=Math.hypot(fx,fy)||1,px=fx/fl,py=fy/fl,rx=-py,ry=px;ctx.moveTo(x+px*12,y+py*12);ctx.lineTo(x-px*8+rx*7,y-py*8+ry*7);ctx.lineTo(x-px*8-rx*7,y-py*8-ry*7);ctx.closePath()}
    else if(s.shipClass==='cruiser'){ctx.moveTo(x,y-10);ctx.lineTo(x+9,y);ctx.lineTo(x,y+10);ctx.lineTo(x-9,y);ctx.closePath()}
    else if(s.shipClass==='battleship'){ctx.rect(x-8,y-8,16,16)}
    else if(s.shipClass==='carrier'){ctx.moveTo(x,y-11);ctx.lineTo(x+3,y-2);ctx.lineTo(x+10,y+3);ctx.lineTo(x+3,y+3);ctx.lineTo(x+2,y+9);ctx.lineTo(x-2,y+9);ctx.lineTo(x-3,y+3);ctx.lineTo(x-10,y+3);ctx.lineTo(x-3,y-2);ctx.closePath()}
    else {ctx.ellipse(x,y,10,6,0,0,Math.PI*2);if(mode==='fill'){ctx.stroke();ctx.beginPath();ctx.ellipse(x,y,5,3,0,0,Math.PI*2)}}
    if(mode==='fill')ctx.fill();else ctx.stroke()
  }
  const hullBox = (s: typeof displayShips[number], x: number, y: number) => s.shipClass==='cruiser' ? {x:x-9,y:y-10,w:18,h:20} : s.shipClass==='carrier' ? {x:x-10,y:y-11,w:20,h:20} : s.shipClass==='submarine' ? {x:x-10,y:y-6,w:20,h:12} : {x:x-8,y:y-10,w:16,h:18}
  screenPicks = []
  if (focusSubject && focusEngaged) { const a = flightPoint(point(focusSubject.x, focusSubject.y), camera.scale), b = flightPoint(point(focusEngaged.x, focusEngaged.y), camera.scale); ctx.strokeStyle = '#e6bd69aa'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]) }
  const depthItems = [
    ...battle.terrain.filter(box=>box.kind==='tower').map(box=>({depth:box.y+box.height,box,ship:null})),
    ...displayShips.filter(ship=>ship.hp>0).map(ship=>({depth:ship.y,box:null,ship})),
  ].sort((a,b)=>a.depth-b.depth)
  const facades: {depth:number;x:number;y:number;w:number;h:number}[] = []
  const placed: {depth:number;ship:typeof displayShips[number];x:number;y:number}[] = []
  for(const item of depthItems) {
    if(item.box) {
      drawBuilding(item.box)
      const p=point(item.box.x,item.box.y), w=item.box.width*camera.scale, h=item.box.height*camera.scale*.78, elevation=(item.box.elevation??5)*camera.scale*.7
      facades.push({depth:item.depth,x:p.x,y:p.y-elevation,w,h})
    } else if(item.ship) {
      drawShip(item.ship)
      const at=flightPoint(point(item.ship.x,item.ship.y),camera.scale)
      placed.push({depth:item.depth,ship:item.ship,x:at.x,y:at.y})
    }
  }
  for(const mark of placed) {
    if(mark.ship.unitKind) continue
    const body=hullBox(mark.ship,mark.x,mark.y)
    const hidden=facades.some(face=>face.depth>mark.depth && body.x<face.x+face.w && body.x+body.w>face.x && body.y<face.y+face.h && body.y+body.h>face.y)
    if(!hidden) continue
    const color=mark.ship.team==='blue'?'#69d5d4':'#f08b83'
    ctx.lineWidth=3;ctx.strokeStyle='#f4fff8';paintHull(mark.ship,mark.x,mark.y,'stroke')
    ctx.lineWidth=1.5;ctx.strokeStyle=color;paintHull(mark.ship,mark.x,mark.y,'stroke')
    ctx.fillStyle=color;ctx.font='12px sans-serif';ctx.fillText(mark.ship.name,mark.x+13,mark.y-5)
  }

  } finally { requestAnimationFrame(drawScene) }
}
function draw(){
if (focusId && ![...battle.ships, ...battle.aircraft].some(s => s.id === focusId && s.hp > 0)) focusId = null
const focusSubject = focusId ? [...battle.ships, ...battle.aircraft].find(s => s.id === focusId) : undefined
const focusEngaged = focusSubject ? [...battle.ships, ...battle.aircraft].find(s => s.id === battle.targets[focusSubject.id] && s.hp > 0) : undefined
el('status').textContent=`${battle.time.toFixed(1)} 秒 · ${battle.result?({blue:'蓝方获胜',red:'红方获胜',draw:'平局 / 超时'} as const)[battle.result]:'交战中'} · 发射 ${battle.shots} / 接触 ${battle.collisions} / 命中 ${battle.hits} / 未接触 ${battle.dodges} · 舰载机 ${battle.aircraft.length}${focusSubject ? ` · 聚焦 ${focusSubject.name}${focusEngaged ? ` → ${focusEngaged.name}` : ' · 搜索中'}` : ''}`
el('play').textContent=running?'暂停':battle.result?'战斗结束':'继续';el<HTMLButtonElement>('play').disabled=Boolean(battle.result);el<HTMLButtonElement>('step').disabled=running||Boolean(battle.result)
el('ships').innerHTML=battle.ships.map(s=>`<div data-id="${s.id}" role="button" aria-pressed="${s.id===focusId}">${s.team==='blue'?'🔹':'🔸'} ${s.name} · HP ${s.hp.toFixed(1)} / ${s.stats.hp} · ${s.weaponSlots.map(slot => `${slot.weapon.model} ${slot.weapon.mounts}×${slot.weapon.barrelsPerMount}`).join(' / ')} · ${({'search':'搜索','approach':'接敌','cover':'冷却找掩体','attack':'就绪进攻','evade':'脱离'} as const)[battle.tactics[s.id] ?? 'search']}${battle.maneuvers[s.id]?`/${({'seek':'航向','approach':'接近','hold':'稳住','orbit_left':'左环绕','orbit_right':'右环绕','evade':'脱离'} as const)[battle.maneuvers[s.id]]}`:''} · 对方情报 ${Math.floor(battle.intel[s.team==='blue'?'red':'blue'][s.id]??0)}</div>`).join('');el('events').innerHTML=[...battle.events].reverse().map(e=>`<p>${e}</p>`).join('')||'<p>等待战斗事件。</p>'}
function stop(){running=false;if(timer!==undefined)clearInterval(timer);timer=undefined}
function step(){previousBattle=battle;battle=stepDogfight(battle);lastStepAt=performance.now();if(battle.result)stop();draw()}
function start(){if(running||battle.result)return;running=true;timer=window.setInterval(step,100/Number(el<HTMLSelectElement>('speed').value))}
el('reset').onclick=()=>{const seed=Number(el<HTMLInputElement>('seed').value);if(el<HTMLInputElement>('seed').value.trim()===''||!Number.isSafeInteger(seed)){el('status').textContent='请输入整数种子';return}const mapSeed=Number(el<HTMLInputElement>('map-seed').value);if(el<HTMLInputElement>('map-seed').value.trim()===''||!Number.isSafeInteger(mapSeed)){el('status').textContent='请输入整数地图种子';return}const fleets=readLineups();if(!fleets){el('status').textContent='双方都至少需要一艘舰船';return}stop();battle=createDogfight(seed,fleets.blue,fleets.red,mapSeed,openSea);previousBattle=battle;lastStepAt=performance.now();camera=targetCamera(battle.ships,canvas.width,canvas.height)!;focusId=null;start();draw()}
function randomizeSeed(id: string) {
  const input = el<HTMLInputElement>(id)
  const previous = Number(input.value) >>> 0
  const value = crypto.getRandomValues(new Uint32Array(1))[0]
  input.value = String(value === previous ? (value + 1) >>> 0 : value)
  persistCurrent()
  el('status').textContent = '种子已更新，点击“应用并重置”开始新战斗'
}
el('random-seed').onclick = () => randomizeSeed('seed')
el('random-map-seed').onclick = () => randomizeSeed('map-seed')
el('play').onclick=()=>{if(running)stop();else start();draw()};el('step').onclick=step;el<HTMLSelectElement>('speed').onchange=()=>{persistCurrent();if(running){stop();start()}}
for(const id of ['seed','map-seed']) el<HTMLInputElement>(id).addEventListener('input',()=>persistCurrent())
el('lineup').addEventListener('change',()=>persistCurrent())
function toggleFocus(id: string) { focusId = focusId === id ? null : id; draw() }
el('ships').addEventListener('click', event => { const card = (event.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (card?.dataset.id) toggleFocus(card.dataset.id) })
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect()
  const sx = (event.clientX - rect.left) * canvas.width / rect.width, sy = (event.clientY - rect.top) * canvas.height / rect.height
  let best: { id: string; d: number } | null = null
  for (const unit of screenPicks) { const d = Math.hypot(unit.x - sx, unit.y - sy); if (d <= 24 && (!best || d < best.d)) best = { id: unit.id, d } }
  if (best) toggleFocus(best.id)
})
el('save-preset').onclick=()=>{
  const name=el<HTMLInputElement>('preset-name').value.trim(), settings=captureSettings()
  if(!name){el('settings-message').textContent='请输入预设名称';return}
  if(!validForBattle(settings)){el('settings-message').textContent='双方需各有舰娘，种子须为整数';return}
  if(stored.presets.some(p=>p.name===name)){el('settings-message').textContent='名称已存在，请换一个名称';return}
  if(stored.presets.length>=20){el('settings-message').textContent='当前场景最多保存 20 个预设';return}
  stored.presets.push({name,settings});if(!persistCurrent()){stored.presets.pop();return}refreshPresets(String(stored.presets.length-1));el('settings-message').textContent=`已保存预设：${name}`
}
el('load-preset').onclick=()=>{
  const value=el<HTMLSelectElement>('preset-list').value,preset=value===''?undefined:stored.presets[Number(value)]
  if(!preset){el('settings-message').textContent='请先选择预设';return}
  applySettings(preset.settings);persistCurrent();el('settings-message').textContent=`已加载 ${preset.name}，点击“应用并重置”开始`;if(running){stop();start()}
}
el('delete-preset').onclick=()=>{
  const value=el<HTMLSelectElement>('preset-list').value;if(value===''){el('settings-message').textContent='请先选择预设';return}
  const index=Number(value),removed=stored.presets.splice(index,1)[0];if(!persistCurrent()){stored.presets.splice(index,0,removed);return}refreshPresets();el('settings-message').textContent=`已删除预设：${removed.name}`
}
if(!initialValid)el('settings-message').textContent='保存的设置不完整，当前战斗使用默认设置；修正后点击“应用并重置”'
start();draw();requestAnimationFrame(drawScene)
