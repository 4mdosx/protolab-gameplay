import type { Motion, StepDirection } from './components'

/** Flight tuning values. Distances are in metres, angles in radians and time in seconds. */
export const SIM_STEP = 0.1
export const MAX_STEPS_PER_FRAME = 5
export const MOTION_SUBSTEP = 0.01
export const HULL_RADIUS = 2

export const THROTTLE_POWER = { 1: 0.1, 2: 0.35 } as const
export const ENERGY = { capacity: 100, regen: 14, fullDrain: 18, brakeDrain: 24, unlockAt: 20 }
export const BRAKE = { thrustMultiplier: 1.5, minSpeed: 0.05 }
export const HEADING = { gain: 2, angleTolerance: 0.025, rateTolerance: 0.025, pointerDeadZone: 1 }
export const COAST_LATERAL_SCALE = 0.2

export const BD = {
  lateralScale: 0.05,
  maxThrustAngle: Math.PI / 3,
  avoidanceMaxThrustAngle: Math.PI / 2,
  maxForwardShare: 0.95,
  courseGain: 1.6,
  minSteeringSpeed: 0.25,
  lookahead: 2.2,
  avoidanceOffsets: [20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150]
    .map(degrees => degrees * Math.PI / 180),
  minAvoidanceBrakeSpeed: 0.5,
}

export const STEP = {
  cost: 32,
  duration: 0.25,
  power: 4.5,
  predictionTicks: 8,
  minCourseChange: 0.15,
  clearanceTieBreak: 0.01,
  offsets: [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6],
}

export const STEP_ANGLE: Record<StepDirection, number> = {
  up: -Math.PI / 2,
  left: Math.PI,
  down: Math.PI / 2,
  right: 0,
}

type Parameters = Omit<Motion, 'velocity'>
export const HANDLING = {
  destroyer: {
    label: '驱逐（轻型）',
    mass: 7,
    thrust: 175,
    drag: 175 / 50 ** 2,
    sideDrag: 0.42,
    lateralGrip: 0.55,
    maxLateralAccel: 7,
    inertia: 45,
    torque: 108,
    maxTurnRate: 1.2,
  },
  cruiser: {
    label: '巡洋（标准）',
    mass: 12,
    thrust: 216,
    drag: 216 / 45 ** 2,
    sideDrag: 0.64,
    lateralGrip: 0.35,
    maxLateralAccel: 4,
    inertia: 120,
    torque: 144,
    maxTurnRate: 0.8,
  },
  battleship: {
    label: '战列（重型）',
    mass: 40,
    thrust: 320,
    drag: 320 / 36 ** 2,
    sideDrag: 1.72,
    lateralGrip: 0.18,
    maxLateralAccel: 1.8,
    inertia: 800,
    torque: 320,
    maxTurnRate: 0.4,
  },
} satisfies Record<string, Parameters & { label: string }>
