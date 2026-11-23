import type { Pose, Vec } from '../components'
import type { Camera } from './view'
import { worldToScreen } from './view'
import { flightPoint, HEIGHT_PROJECTION } from '../../dogfight/projection'

export type Joint = [forward: number, right: number, height: number]

/** Legs articulate toward the exhaust axis independently of hull yaw. */
export function legJoints(heading: number, exhaustAngle: number, sign: number) {
  const angle = exhaustAngle - heading
  const f = Math.cos(angle),
    r = Math.sin(angle)
  return {
    hip: [0, sign * 0.35, -0.25] as Joint,
    knee: [f * 0.4, sign * 0.48 + r * 0.4, -1.05] as Joint,
    heel: [f * 0.95, sign * 0.6 + r * 0.95, -1.7] as Joint,
  }
}

/** Upright flight suit: yaw rotates only the ground plane, never the vertical axis. */
export function drawHumanoid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  pose: Pose,
  acceleration: Vec,
  ghost = false,
  exhaustAngle = pose.heading + Math.PI,
  power = 0,
) {
  const c = Math.cos(pose.heading),
    s = Math.sin(pose.heading)
  const forward = Math.tanh((acceleration.x * c + acceleration.y * s) / 22)
  const side = Math.tanh((-acceleration.x * s + acceleration.y * c) / 22)
  const leanF = 0.2 + forward * 0.55,
    leanS = side * 0.55
  const point = ([f, r, z]: Joint) => {
    const p = flightPoint(
      worldToScreen(camera, ctx.canvas.width, ctx.canvas.height, {
        x: pose.x + c * f - s * r,
        y: pose.y + s * f + c * r,
      }),
      camera.scale,
    )
    return { x: p.x, y: p.y - z * HEIGHT_PROJECTION * camera.scale }
  }
  const armor = ghost ? '#a8fbff' : '#78d9d4'
  const dark = ghost ? '#a8fbff' : '#294857'
  const light = ghost ? '#a8fbff' : '#d5f6ed'
  const segment = (a: Joint, b: Joint, width: number, color: string) => {
    const p = point(a),
      q = point(b)
    ctx.strokeStyle = color
    ctx.lineWidth = width * camera.scale
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
  const sphere = (joint: Joint, radius: number, color: string) => {
    const p = point(joint)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, radius * camera.scale, radius * camera.scale, 0, 0, Math.PI * 2)
    ctx.fill()
    if (!ghost) {
      ctx.fillStyle = '#ffffff30'
      ctx.beginPath()
      ctx.ellipse(
        p.x - radius * camera.scale * 0.2,
        p.y - radius * camera.scale * 0.3,
        radius * camera.scale * 0.5,
        radius * camera.scale * 0.3,
        -0.3,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
  const leg = (sign: number) => {
    const { hip, knee, heel } = legJoints(pose.heading, exhaustAngle, sign)
    const angle = exhaustAngle - pose.heading
    const f = Math.cos(angle),
      r = Math.sin(angle)
    segment(hip, knee, 0.48, dark)
    sphere(knee, 0.24, light)
    segment(knee, heel, 0.42, armor)
    segment([heel[0] - f * 0.2, heel[1] - r * 0.2, heel[2]], heel, 0.45, dark)
    sphere(heel, 0.2, ghost ? armor : '#ffc47b')
    if (!ghost && power > 0) {
      const length = 0.8 + power * 1.7
      segment(
        heel,
        [heel[0] + f * length, heel[1] + r * length, heel[2]],
        0.32 + power * 0.1,
        '#ff8e48',
      )
      segment(
        heel,
        [heel[0] + f * length * 0.6, heel[1] + r * length * 0.6, heel[2]],
        0.18,
        '#fff1b6',
      )
    }
  }
  const arm = (sign: number) => {
    const shoulder: Joint = [leanF, sign * 0.65 + leanS, 1]
    const elbow: Joint = [-0.25 - forward * 0.35, sign * 1.05 - side * 0.2, 0.35]
    const hand: Joint = [-0.5 - forward * 0.55, sign * 1.1 - side * 0.4, -0.2]
    sphere(shoulder, 0.32, armor)
    segment(shoulder, elbow, 0.35, armor)
    sphere(elbow, 0.2, light)
    segment(elbow, hand, 0.28, dark)
    sphere(hand, 0.22, light)
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Side whose ground-plane Y is smaller is farther from the viewer.
  const far = c >= 0 ? -1 : 1
  leg(far)
  arm(far)
  segment([0, -0.35, -0.25], [0, 0.35, -0.25], 0.55, dark)
  segment([0, 0, 0], [leanF, leanS, 1.05], 1.1, armor)
  // Forward chest plate and rear equipment pack swap visibility as yaw changes.
  if (s >= 0) segment([0.35, 0, 0.25], [leanF + 0.35, leanS, 0.9], 0.45, light)
  else segment([-0.35, 0, 0.15], [leanF - 0.35, leanS, 0.9], 0.65, dark)
  leg(-far)
  arm(-far)
  segment([leanF, leanS, 1], [leanF * 1.15, leanS * 1.15, 1.5], 0.35, dark)
  const head: Joint = [leanF * 1.15, leanS * 1.15, 1.95]
  sphere(head, 0.62, dark)
  sphere([head[0], head[1], head[2] + 0.1], 0.48, light)
  // Visor projects onto the front of the helmet; rear view shows the helmet shell.
  if (s > -0.3)
    segment(
      [head[0] + 0.48, head[1] - 0.28, head[2]],
      [head[0] + 0.48, head[1] + 0.28, head[2]],
      0.2,
      ghost ? armor : '#ffce7b',
    )
  else sphere([head[0] - 0.25, head[1], head[2]], 0.16, armor)
  ctx.restore()
}
