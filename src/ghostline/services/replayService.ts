/**
 * Replay Service
 * Compiles recorded telemetry into executable replay frames
 */

import type { RawSample, ReplayFrame } from '../types'

export interface CompileOptions {
  sampleInterval: number // ms between samples
  replayInterval: number // ms between replay frames
  smoothingMode: 'none' | 'linear' | 'cubic'
  commandClamps: {
    maxRoll: number
    maxPitch: number
    maxYaw: number
    maxThrottle: number
  }
}

/**
 * Compile raw telemetry into replay frames
 */
export function compileReplayFrames(
  telemetry: RawSample[],
  options: CompileOptions
): ReplayFrame[] {
  if (telemetry.length === 0) return []
  
  const frames: ReplayFrame[] = []
  const startTime = telemetry[0].timestamp
  
  // Resample telemetry at replay interval
  const targetInterval = options.replayInterval
  let currentTime = 0
  
  while (currentTime <= telemetry[telemetry.length - 1].timestamp - startTime) {
    const absoluteTime = startTime + currentTime
    
    // Find surrounding samples
    const sample = interpolateSample(telemetry, absoluteTime, options.smoothingMode)
    
    if (sample) {
      // Extract command from joystick input
      const command = extractCommand(sample, options.commandClamps)
      
      frames.push({
        timestampOffset: currentTime,
        roll: command.roll,
        pitch: command.pitch,
        yaw: command.yaw,
        throttle: command.throttle,
        targetDuration: targetInterval,
      })
    }
    
    currentTime += targetInterval
  }
  
  return frames
}

/**
 * Interpolate sample at specific timestamp
 */
function interpolateSample(
  telemetry: RawSample[],
  timestamp: number,
  mode: 'none' | 'linear' | 'cubic'
): RawSample | null {
  // Find surrounding samples
  let beforeIndex = -1
  let afterIndex = -1
  
  for (let i = 0; i < telemetry.length; i++) {
    if (telemetry[i].timestamp <= timestamp) {
      beforeIndex = i
    }
    if (telemetry[i].timestamp >= timestamp && afterIndex === -1) {
      afterIndex = i
      break
    }
  }
  
  // Edge cases
  if (beforeIndex === -1) return telemetry[0]
  if (afterIndex === -1) return telemetry[telemetry.length - 1]
  if (beforeIndex === afterIndex) return telemetry[beforeIndex]
  
  const before = telemetry[beforeIndex]
  const after = telemetry[afterIndex]
  
  if (mode === 'none') {
    // Nearest neighbor
    const distBefore = timestamp - before.timestamp
    const distAfter = after.timestamp - timestamp
    return distBefore < distAfter ? before : after
  }
  
  // Linear interpolation
  const t = (timestamp - before.timestamp) / (after.timestamp - before.timestamp)
  
  return {
    timestamp,
    joystick: {
      leftX: lerp(before.joystick?.leftX || 0, after.joystick?.leftX || 0, t),
      leftY: lerp(before.joystick?.leftY || 0, after.joystick?.leftY || 0, t),
      rightX: lerp(before.joystick?.rightX || 0, after.joystick?.rightX || 0, t),
      rightY: lerp(before.joystick?.rightY || 0, after.joystick?.rightY || 0, t),
    },
    buttons: before.buttons, // Don't interpolate buttons
    command: {
      roll: lerp(before.command?.roll || 0, after.command?.roll || 0, t),
      pitch: lerp(before.command?.pitch || 0, after.command?.pitch || 0, t),
      yaw: lerp(before.command?.yaw || 0, after.command?.yaw || 0, t),
      throttle: lerp(before.command?.throttle || 0, after.command?.throttle || 0, t),
    },
    sensor: before.sensor, // Use nearest sensor data
    position: before.position && after.position ? {
      time: timestamp,
      x: lerp(before.position.x, after.position.x, t),
      y: lerp(before.position.y, after.position.y, t),
      z: lerp(before.position.z, after.position.z, t),
    } : before.position,
  }
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Extract command from sample with clamping
 */
function extractCommand(
  sample: RawSample,
  clamps: { maxRoll: number; maxPitch: number; maxYaw: number; maxThrottle: number }
): { roll: number; pitch: number; yaw: number; throttle: number } {
  // Use command if available, otherwise derive from joystick
  let roll = sample.command?.roll || sample.joystick?.rightX || 0
  let pitch = sample.command?.pitch || sample.joystick?.rightY || 0
  let yaw = sample.command?.yaw || sample.joystick?.leftX || 0
  let throttle = sample.command?.throttle || sample.joystick?.leftY || 0
  
  // Clamp values
  roll = Math.max(-clamps.maxRoll, Math.min(clamps.maxRoll, roll))
  pitch = Math.max(-clamps.maxPitch, Math.min(clamps.maxPitch, pitch))
  yaw = Math.max(-clamps.maxYaw, Math.min(clamps.maxYaw, yaw))
  throttle = Math.max(-clamps.maxThrottle, Math.min(clamps.maxThrottle, throttle))
  
  return { roll, pitch, yaw, throttle }
}

/**
 * Execute replay frames via drone service
 */
export async function executeReplay(
  frames: ReplayFrame[],
  droneService: any,
  onProgress?: (frame: number, total: number) => void
): Promise<void> {
  console.log(`Executing replay with ${frames.length} frames`)
  
  // Takeoff
  await droneService.takeoff()
  await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for stable hover
  
  // Execute frames
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    
    // Set control values
    await droneService.setControl(
      frame.roll,
      frame.pitch,
      frame.yaw,
      frame.throttle
    )
    
    // Execute movement for frame duration
    await droneService.move(frame.targetDuration / 1000) // Convert ms to seconds
    
    // Progress callback
    if (onProgress) {
      onProgress(i + 1, frames.length)
    }
  }
  
  // Land
  await droneService.resetMove()
  await droneService.land()
  
  console.log('Replay complete')
}
