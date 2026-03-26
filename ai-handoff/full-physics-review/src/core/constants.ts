import type { Vector3 } from './types'

export const GRID_SIZE_CM = 10
export const DEFAULT_CRUISE_SPEED_CM_S = 70
export const DEFAULT_TURN_SPEED_DEG_S = 110
export const DEFAULT_TAKEOFF_HEIGHT_CM = 45
export const DEFAULT_INPUT_STRENGTH = 58
export const MAX_PITCH_ROLL_SPEED_CM_S = 135
export const MAX_THROTTLE_SPEED_CM_S = 115
export const MAX_YAW_SPEED_DEG_S = 185
export const DEFAULT_FIELD_WIDTH_CM = 520
export const DEFAULT_FIELD_LENGTH_CM = 520
export const DEFAULT_FIELD_HEIGHT_CM = 260
export const WORLD_SCALE = 0.01
export const PLAYBACK_TICK_MS = 50
export const MONTE_CARLO_RUNS = 12
export const MAX_HISTORY_ENTRIES = 40
export const DRONE_DIMENSIONS_CM = {
  width: 13.88,
  length: 13.85,
  height: 3.48,
}
export const DRONE_DIMENSIONS_WORLD = {
  width: 0.1388,
  length: 0.1385,
  height: 0.0348,
}
export const DRONE_BODY_BOX_WORLD = {
  x: 0.054,
  y: 0.016,
  z: 0.042,
}
export const DRONE_TOP_BOX_WORLD = {
  x: 0.045,
  y: 0.012,
  z: 0.03,
}
export const DRONE_ARM_X_BOX_WORLD = {
  x: 0.112,
  y: 0.005,
  z: 0.01,
}
export const DRONE_ARM_Z_BOX_WORLD = {
  x: 0.01,
  y: 0.005,
  z: 0.112,
}
export const DRONE_MOTOR_RADIUS_WORLD = 0.0105
export const DRONE_MOTOR_OFFSETS_WORLD: Array<[number, number, number]> = [
  [0.055, 0.004, 0.055],
  [0.055, 0.004, -0.055],
  [-0.055, 0.004, 0.055],
  [-0.055, 0.004, -0.055],
]
export const DRONE_COLLIDER_HALF_EXTENTS_CM: Vector3 = {
  x: DRONE_DIMENSIONS_CM.width * 0.5,
  y: DRONE_DIMENSIONS_CM.height * 0.5,
  z: DRONE_DIMENSIONS_CM.length * 0.5,
}
export const PHYSICS_STEP_SECONDS = 1 / 60
export const PHYSICS_SETTLE_SECONDS = 1.4
export const DRONE_MASS_KG = 0.0548
export const DRONE_MASS_WITH_BATTERY_KG = 0.0584
export const DRONE_BATTERY_VOLTAGE_V = 3.7
export const DRONE_BATTERY_CAPACITY_AH = 0.53
export const DRONE_BATTERY_C_RATING = 20
export const DRONE_MAX_SPEED_MPS = 2.5
export const AIR_DENSITY_KG_M3 = 1.225
export const DRONE_DRAG_COEFFICIENT = 1.05
export const DRONE_ROTOR_RADIUS_M = 0.028
export const DRONE_ROTOR_COUNT = 4
export const DRONE_FRONTAL_AREA_M2 =
  DRONE_DIMENSIONS_WORLD.width * DRONE_DIMENSIONS_WORLD.height
export const DRONE_PLANFORM_AREA_M2 =
  DRONE_DIMENSIONS_WORLD.width * DRONE_DIMENSIONS_WORLD.length

export const ZERO_VECTOR: Vector3 = {
  x: 0,
  y: 0,
  z: 0,
}
