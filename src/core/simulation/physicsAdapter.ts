import { Body, Vec3, World } from 'cannon-es'

export interface PhysicsWorldAdapter {
  world: World
}

export interface PhysicsBodyAdapter {
  body: Body
}

export function createPhysicsWorld(): PhysicsWorldAdapter {
  return { world: new World() }
}

export function addPhysicsBody(adapter: PhysicsWorldAdapter, body: Body): PhysicsBodyAdapter {
  adapter.world.addBody(body)
  return { body }
}

export function stepPhysicsWorld(adapter: PhysicsWorldAdapter, dt: number) {
  adapter.world.step(dt)
}

export function applyBodyForce(adapter: PhysicsBodyAdapter, force: Vec3, point: Vec3) {
  adapter.body.applyForce(force, point)
}

export function getBodyState(adapter: PhysicsBodyAdapter) {
  return {
    position: adapter.body.position,
    velocity: adapter.body.velocity,
    quaternion: adapter.body.quaternion,
    angularVelocity: adapter.body.angularVelocity,
  }
}
