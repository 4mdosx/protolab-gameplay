import type { AiModule } from './types'
/** These parameters control the existing dogfight behavior; they are not trained agents. */
export const aiModules: Record<string, AiModule> = {
  scout: { id: 'scout', name: '接近侦察', useCover: true, preferredRange: 24, orbitStrength: .9, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2 },
  escort: { id: 'escort', name: '中距护卫', useCover: true, preferredRange: 35, orbitStrength: .9, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2 },
  artillery: { id: 'artillery', name: '远距炮击', useCover: true, preferredRange: 44, orbitStrength: .9, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2 },
  aviation: { id: 'aviation', name: '机动航空', useCover: true, preferredRange: 30, orbitStrength: .9, dodgeStrength: 2, turnRate: .8, turnAcceleration: 1.2 },
}
