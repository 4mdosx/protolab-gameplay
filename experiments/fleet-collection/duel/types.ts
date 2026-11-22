export const DT = 0.1

export interface Vec { x: number; y: number }

export interface Hull {
  id: string
  team: 'blue' | 'red'
  name: string
  x: number
  y: number
  heading: number
  turnRate: number
  velocity: Vec
  hp: number
  cooldown: number
}

/** What the pilot is allowed to ask for. Movement is the only writer of position and heading. */
export interface Command {
  velocity: Vec
  facing: number
}

export interface Shot {
  id: number
  team: 'blue' | 'red'
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface Duel {
  time: number
  hulls: Hull[]
  shots: Shot[]
  nextShot: number
  log: string[]
}
