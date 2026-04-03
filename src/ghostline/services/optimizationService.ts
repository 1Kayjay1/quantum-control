/**
 * Optimization Service
 * Implements iterative route optimization using mutation strategies
 */

import type { ReplayFrame, RunRecord, Checkpoint, OptimizerConfig } from '../types'
import { executeReplay } from './replayService'

export interface OptimizationState {
  generation: number
  bestTime: number
  bestRunId: string
  elitePool: RunRecord[]
  running: boolean
}

export type MutationStrategy = 
  | 'timing_compression'
  | 'timing_expansion'
  | 'pitch_roll_adjustment'
  | 'yaw_adjustment'
  | 'segment_swap'

/**
 * Optimization Engine
 */
export class OptimizationEngine {
  private state: OptimizationState
  private config: OptimizerConfig
  private onProgress?: (state: OptimizationState) => void
  
  constructor(
    _sessionId: string,
    baselineRun: RunRecord,
    _checkpoints: Checkpoint[],
    config: OptimizerConfig,
    onProgress?: (state: OptimizationState) => void
  ) {
    this.config = config
    this.onProgress = onProgress
    
    this.state = {
      generation: 0,
      bestTime: baselineRun.summary.elapsedTime,
      bestRunId: baselineRun.summary.runId,
      elitePool: [baselineRun],
      running: false,
    }
  }
  
  /**
   * Run optimization loop
   */
  async optimize(
    droneService: any,
    maxGenerations: number = 50
  ): Promise<void> {
    this.state.running = true
    
    try {
      for (let gen = 0; gen < maxGenerations; gen++) {
        if (!this.state.running) break
        
        this.state.generation = gen + 1
        
        // Select parent from elite pool
        const parent = this.selectParent()
        
        // Generate candidate mutation
        const candidate = this.mutate(parent)
        
        // Execute candidate run
        const result = await this.executeCandidate(candidate, droneService)
        
        // Evaluate and update elite pool
        if (result.summary.isValid) {
          this.updateElitePool(result)
          
          if (result.summary.elapsedTime < this.state.bestTime) {
            this.state.bestTime = result.summary.elapsedTime
            this.state.bestRunId = result.summary.runId
            console.log(`🎉 New best time: ${this.state.bestTime.toFixed(2)}s (gen ${this.state.generation})`)
          }
        }
        
        // Progress callback
        if (this.onProgress) {
          this.onProgress({ ...this.state })
        }
        
        // Safety: Check battery
        if (result.summary.batteryEnd < this.config.lowBatteryThreshold) {
          console.log('⚠️ Low battery, pausing optimization')
          break
        }
      }
    } finally {
      this.state.running = false
    }
  }
  
  /**
   * Stop optimization
   */
  stop(): void {
    this.state.running = false
  }
  
  /**
   * Select parent from elite pool
   */
  private selectParent(): RunRecord {
    // Weighted selection favoring better times
    const weights = this.state.elitePool.map(run => 
      1 / (run.summary.elapsedTime + 0.1)
    )
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    
    let random = Math.random() * totalWeight
    for (let i = 0; i < this.state.elitePool.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return this.state.elitePool[i]
      }
    }
    
    return this.state.elitePool[0]
  }
  
  /**
   * Generate mutated candidate
   */
  private mutate(parent: RunRecord): RunRecord {
    // Choose random mutation strategy
    const strategies: MutationStrategy[] = [
      'timing_compression',
      'timing_expansion',
      'pitch_roll_adjustment',
      'yaw_adjustment',
    ]
    const strategy = strategies[Math.floor(Math.random() * strategies.length)]
    
    // Clone parent
    const candidate: RunRecord = {
      ...parent,
      summary: {
        ...parent.summary,
        runId: `run_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        generation: this.state.generation,
        parentCandidateId: parent.summary.runId,
        mutationDescription: strategy,
        isBaseline: false,
        isBestSoFar: false,
      },
      replayFrames: [...(parent.replayFrames || [])],
    }
    
    // Apply mutation
    switch (strategy) {
      case 'timing_compression':
        candidate.replayFrames = this.mutateTimingCompression(candidate.replayFrames)
        break
      case 'timing_expansion':
        candidate.replayFrames = this.mutateTimingExpansion(candidate.replayFrames)
        break
      case 'pitch_roll_adjustment':
        candidate.replayFrames = this.mutatePitchRoll(candidate.replayFrames)
        break
      case 'yaw_adjustment':
        candidate.replayFrames = this.mutateYaw(candidate.replayFrames)
        break
    }
    
    return candidate
  }
  
  /**
   * Timing compression mutation
   */
  private mutateTimingCompression(frames: ReplayFrame[]): ReplayFrame[] {
    const factor = 1 - this.config.mutationSizes.timingCompression
    return frames.map(frame => ({
      ...frame,
      targetDuration: frame.targetDuration * factor,
    }))
  }
  
  /**
   * Timing expansion mutation
   */
  private mutateTimingExpansion(frames: ReplayFrame[]): ReplayFrame[] {
    const factor = 1 + this.config.mutationSizes.timingExpansion
    return frames.map(frame => ({
      ...frame,
      targetDuration: frame.targetDuration * factor,
    }))
  }
  
  /**
   * Pitch/roll adjustment mutation
   */
  private mutatePitchRoll(frames: ReplayFrame[]): ReplayFrame[] {
    const adjustment = this.config.mutationSizes.pitchRollAdjustment
    const sign = Math.random() < 0.5 ? -1 : 1
    const axis = Math.random() < 0.5 ? 'pitch' : 'roll'
    
    return frames.map(frame => ({
      ...frame,
      [axis]: Math.max(
        -this.config.commandClamps.maxPitch,
        Math.min(
          this.config.commandClamps.maxPitch,
          frame[axis] + sign * adjustment
        )
      ),
    }))
  }
  
  /**
   * Yaw adjustment mutation
   */
  private mutateYaw(frames: ReplayFrame[]): ReplayFrame[] {
    const adjustment = this.config.mutationSizes.yawAdjustment
    const sign = Math.random() < 0.5 ? -1 : 1
    
    return frames.map(frame => ({
      ...frame,
      yaw: Math.max(
        -this.config.commandClamps.maxYaw,
        Math.min(
          this.config.commandClamps.maxYaw,
          frame.yaw + sign * adjustment
        )
      ),
    }))
  }
  
  /**
   * Execute candidate run
   */
  private async executeCandidate(
    candidate: RunRecord,
    droneService: any
  ): Promise<RunRecord> {
    const startTime = Date.now()
    
    try {
      // Execute replay
      await executeReplay(candidate.replayFrames, droneService)
      
      const endTime = Date.now()
      const elapsedTime = (endTime - startTime) / 1000
      
      // Update summary
      candidate.summary.elapsedTime = elapsedTime
      candidate.summary.wallClockStart = new Date(startTime).toISOString()
      candidate.summary.wallClockEnd = new Date(endTime).toISOString()
      candidate.summary.isValid = true // TODO: Check checkpoints
      candidate.summary.checkpointResults = [] // TODO: Evaluate checkpoints
      
      return candidate
    } catch (error) {
      console.error('Candidate execution failed:', error)
      candidate.summary.isValid = false
      candidate.summary.abortReason = error instanceof Error ? error.message : 'Unknown error'
      return candidate
    }
  }
  
  /**
   * Update elite pool
   */
  private updateElitePool(candidate: RunRecord): void {
    // Add candidate to pool
    this.state.elitePool.push(candidate)
    
    // Sort by elapsed time
    this.state.elitePool.sort((a, b) => a.summary.elapsedTime - b.summary.elapsedTime)
    
    // Keep only top N
    if (this.state.elitePool.length > this.config.elitePoolSize) {
      this.state.elitePool = this.state.elitePool.slice(0, this.config.elitePoolSize)
    }
  }
  
  /**
   * Get current state
   */
  getState(): OptimizationState {
    return { ...this.state }
  }
}
