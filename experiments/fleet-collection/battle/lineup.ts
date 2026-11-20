import { profiles, type Team } from './model'

export function mountLineups(container: HTMLElement, includeLayers = false) {
  container.innerHTML = (['blue', 'red'] as Team[]).map(team => `<fieldset><legend>${team === 'blue' ? '蓝方' : '红方'}编队</legend><div class="lineup-slots">${Array.from({ length: 6 }, (_, slot) => `<label>位置 ${slot + 1} <select id="${team}-slot-${slot}"><option value="" ${slot >= 3 ? 'selected' : ''}>空位</option>${profiles.filter(p => includeLayers || p.layer === 'surface').map((p, i) => `<option value="${i}" ${i === slot ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`).join('')
}
export function readLineups(): { blue: number[]; red: number[] } | null {
  const read = (team: Team) => Array.from({ length: 6 }, (_, i) => (document.getElementById(`${team}-slot-${i}`) as HTMLSelectElement).value).filter(v => v !== '').map(Number)
  const blue = read('blue'), red = read('red')
  return blue.length && red.length ? { blue, red } : null
}
