export interface Vec { x: number; y: number }

export interface Ship { name: string; hp: number }

export interface Body { x: number; y: number; heading: number; turnRate: number; turnEffort: number }

export interface Motion { dashDistance: number; inertia: number; torque: number; maxTurnRate: number; velocity: Vec; mass: number; thrust: number; drag: number; sideDrag: number; lateralGrip: number; maxLateralAccel: number }

/** `local` is the gun angle relative to the hull. `dead` means the aim sits outside the mount arc. */
export interface Gun { arc: number; traverse: number; local: number; aim: number | null; dead: boolean }

/** Written only by the control system. Motion and the gun read it. */
export interface Command { dashStep?: number; braking?: boolean; brakeFraction?: number; dashFraction?: number; power: number; thrustAngle: number; turn: number }

export interface Pilot { scheme: 'manual' }

/** Page input. Only the control system reads this. */
export interface Input { brake?: boolean; dashRequested?: boolean; fireQueue?: (0 | 1 | 2)[]; selectedGun?: 0 | 1 | 2; reverseControl: boolean; turn: number; throttle: 0 | 1 | 2 | 3; aim: Vec | null }

export interface Pose { x: number; y: number; heading: number; vx: number; vy: number }

export interface DroneGun extends Gun { weaponClass: import('./weapons').WeaponClass; cooldown: number; wavesLeft: number; waveTimer: number; name: string; center: number; side: -1 | 1; target: number }

export interface Projectile { owner?: number; radius: number; x: number; y: number; vx: number; vy: number; life: number; weapon: number }

export interface Recoil { fx: number; fy: number; remaining: number }

export interface Energy { value: number; dashLeft: number; dashCooldown: number; locked: boolean }

export interface DashVisual { from: Vec; to: Vec; heading: number; life: number; evade: number }
