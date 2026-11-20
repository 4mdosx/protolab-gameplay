import type { AiTactic } from '../../config'

export type Maneuver = 'seek' | 'approach' | 'hold' | 'orbit_left' | 'orbit_right' | 'evade'

export interface MovementCommand {
  desiredVelocity: { x: number; y: number }
  desiredFacing: number
  maneuver: Maneuver
}

/** The only write path for a destroyer's movement command. */
export function setMovementCommand(store: Record<string, MovementCommand>, id: string, command: MovementCommand) {
  if (!Number.isFinite(command.desiredFacing) || !Number.isFinite(command.desiredVelocity.x) || !Number.isFinite(command.desiredVelocity.y)) throw new Error(`invalid movement command for ${id}`)
  store[id] = { ...command, desiredVelocity: { ...command.desiredVelocity }, desiredFacing: Math.atan2(Math.sin(command.desiredFacing), Math.cos(command.desiredFacing)) }
}

export interface DestroyerSteerInput {
  cruise: number
  tactic: AiTactic
  aggression: number
  preferred: number
  distance: number
  ux: number
  uy: number
  travelHeading: number
  blocked: boolean
  inRange: boolean
  buildingOrbit: boolean
  side: number
  previous?: Maneuver
  held: boolean
}

/** Turn a destroyer's tactic into a velocity command and a separate facing. */
export function steerDestroyer(input: DestroyerSteerInput): MovementCommand {
  const travel = { x: Math.cos(input.travelHeading) * input.cruise, y: Math.sin(input.travelHeading) * input.cruise }
  if (input.tactic === 'evade') return { desiredVelocity: travel, desiredFacing: input.travelHeading, maneuver: 'evade' }
  const gunsCanBear = (input.tactic === 'attack' || input.tactic === 'approach') && !input.blocked && input.inRange && !input.buildingOrbit && input.distance > 0
  if (!gunsCanBear) return { desiredVelocity: travel, desiredFacing: input.travelHeading, maneuver: 'seek' }
  const face = Math.atan2(input.uy, input.ux)
  const left = { x: -input.uy * input.cruise * 0.85, y: input.ux * input.cruise * 0.85 }
  const right = { x: input.uy * input.cruise * 0.85, y: -input.ux * input.cruise * 0.85 }
  const options: { id: Maneuver; velocity: { x: number; y: number }; score: number }[] = [
    { id: 'approach', velocity: { x: input.ux * input.cruise, y: input.uy * input.cruise }, score: input.distance > input.preferred ? 1 : 0.25 },
    { id: 'hold', velocity: { x: input.ux * input.cruise * 0.15, y: input.uy * input.cruise * 0.15 }, score: input.distance <= input.preferred ? 1 - input.aggression : 0.15 },
    { id: 'orbit_left', velocity: left, score: 0.45 + input.aggression * 0.45 + (input.side > 0 ? 0.05 : 0) },
    { id: 'orbit_right', velocity: right, score: 0.45 + input.aggression * 0.45 + (input.side < 0 ? 0.05 : 0) },
  ]
  const kept = input.held && input.previous ? options.find(option => option.id === input.previous) : undefined
  const best = kept ?? [...options].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0]
  return { desiredVelocity: best.velocity, desiredFacing: face, maneuver: best.id }
}
