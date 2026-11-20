export type SoundEvent =
  | 'ui.click'
  | 'ui.confirm'
  | 'combat.hit'
  | 'combat.laser'
  | 'reward'
  | 'warning'
const tones: Record<SoundEvent, [number, number]> = {
  'ui.click': [440, 0.04],
  'ui.confirm': [660, 0.1],
  'combat.hit': [120, 0.08],
  'combat.laser': [880, 0.1],
  reward: [880, 0.2],
  warning: [220, 0.2],
}
let audio: AudioContext | undefined
/** Call after a user gesture; audio is generated locally and requires no downloaded files. */
export function playSound(event: SoundEvent, options: { volume?: number; pitch?: number } = {}) {
  audio ??= new AudioContext()
  const [frequency, duration] = tones[event]
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = frequency * (options.pitch ?? 1)
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, options.volume ?? 0.08)), audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + duration)
}
