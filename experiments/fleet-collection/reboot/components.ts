export interface Vec { x: number; y: number }

export interface Ship { name: string; hp: number }

export interface Body { x: number; y: number; heading: number; turnRate: number; turnEffort: number }

export interface Motion { inertia: number; torque: number; maxTurnRate: number; velocity: Vec; mass: number; thrust: number; drag: number; sideDrag: number; lateralGrip: number; maxLateralAccel: number }

/** `local` is the gun angle relative to the hull. `dead` means the aim sits outside the mount arc. */
export interface Gun { arc: number; traverse: number; local: number; aim: number | null; dead: boolean }

/** Control requests after energy limits have been applied. */
export interface Command {
  power: number
  thrustAngle: number
  appliedThrustAngle?: number
  turn: number
  recentering?: boolean
  fullThrust?: boolean
  bd?: boolean
  avoidingObstacle?: boolean
  brakeFraction?: number
  step?: { angle: number; fraction: number; power: number }
}

export interface Pilot {
  scheme: 'manual'
  thrustAngle: number
  recenterAngle?: number
  bdCourse?: number
  boostInterrupted?: boolean
}

export type StepDirection = 'up' | 'left' | 'down' | 'right'

/** Input sampled from the player controls. */
export interface Input {
  lockTarget?: number
  brake?: boolean
  recenterHeading?: number
  boostHeld?: boolean
  boostPressed?: boolean
  stepDirection?: StepDirection
  fireQueue?: (0 | 1 | 2)[]
  selectedGun?: 0 | 1 | 2
  reverseControl: boolean
  turn: number
  throttle: 1 | 2
  aim: Vec | null
}

export interface Pose { x: number; y: number; heading: number; vx: number; vy: number }

export interface DroneGun extends Gun { barrage: import('./weapons').BarrageSpec; cooldown: number; wavesLeft: number; waveTimer: number; name: string; center: number; side: -1 | 1; target: number; manualTarget?: number }

export interface Projectile { owner?: number; radius: number; x: number; y: number; vx: number; vy: number; life: number; weapon: number }

export interface Recoil { fx: number; fy: number; remaining: number }

export interface Energy {
  value: number
  locked: boolean
  step?: { angle: number; remaining: number }
  feedback?: string
}
