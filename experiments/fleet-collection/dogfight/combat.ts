import type { Ship, Weapon } from '../battle/model'

// Relative-motion segment test catches projectiles that cross a moving target between updates.
export function hitTime(p: {x:number;y:number}, q: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}, radius: number): number | null {
  const x = p.x-a.x, y = p.y-a.y, vx = q.x-p.x-(b.x-a.x), vy = q.y-p.y-(b.y-a.y)
  const c=x*x+y*y-radius*radius
  if(c<=0) return 0
  const aa=vx*vx+vy*vy, bb=2*(x*vx+y*vy), discriminant=bb*bb-4*aa*c
  if(aa===0||discriminant<0) return null
  const t=(-bb-Math.sqrt(discriminant))/(2*aa)
  return t>=0&&t<=1?t:null
}
export function sweptHit(p: {x:number;y:number}, q: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}, radius: number): boolean {
  return hitTime(p,q,a,b,radius)!==null
}
export function canAttack(ship: Ship, target: Ship, weapon: Weapon = ship.weaponSlots[0].weapon): boolean {
  if (weapon.delivery === 'aircraft') return false // Carrier aircraft spawning is not implemented.
  return weapon.delivery === 'torpedo' ? target.layer !== 'air' : target.layer !== 'submerged'
}
