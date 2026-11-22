export interface Vec { x: number; y: number }

export interface Ship { name: string }

export interface Body { x: number; y: number; heading: number; turnRate: number }

export interface Motion { velocity: Vec; cruise: number; thrust: number }

/** `local` is the gun angle relative to the hull. `dead` means the aim sits outside the mount arc. */
export interface Gun { arc: number; traverse: number; local: number; aim: number | null; dead: boolean }

/** Written only by the control system. Motion and the gun read it. */
export interface Command { velocity: Vec; facing: number; aim: number | null }

export interface Pilot { scheme: 'manual' }

/** Page input. Only the control system reads this. */
export interface Input { x: number; y: number; aim: Vec | null }

export interface Pose { x: number; y: number; heading: number; vx: number; vy: number; gun: number; dead: boolean; aim: number | null }
