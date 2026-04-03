import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type {
  Checkpoint,
  ConnectionState,
  EliteMemory,
  OptimizerConfig,
  RunRecord,
  SafetyState,
  SessionState,
} from './types'

interface GhostlineStore {
  // Session state
  session: SessionState | null
  startSession: () => void
  endSession: () => void

  // Connection state
  connection: ConnectionState
  setConnection: (connection: Partial<ConnectionState>) => void

  // Safety state
  safety: SafetyState | null
  setSafety: (safety: SafetyState) => void

  // Checkpoints
  checkpoints: Checkpoint[]
  addCheckpoint: (checkpoint: Checkpoint) => void
  updateCheckpoint: (id: string, updates: Partial<Checkpoint>) => void
  removeCheckpoint: (id: string) => void

  // Elite memory (persisted)
  eliteMemory: EliteMemory
  setBaselineRun: (run: RunRecord) => void
  setBestRun: (run: RunRecord) => void
  addToElitePool: (run: RunRecord) => void

  // Configuration
  config: OptimizerConfig
  setConfig: (config: Partial<OptimizerConfig>) => void

  // Current run
  currentRun: RunRecord | null
  setCurrentRun: (run: RunRecord | null) => void
}

const DEFAULT_CONFIG: OptimizerConfig = {
  sampleInterval: 50,
  replayInterval: 50,
  commandClamps: {
    maxRoll: 100,
    maxPitch: 100,
    maxYaw: 100,
    maxThrottle: 100,
  },
  smoothingMode: 'linear',
  checkpointRadius: 30,
  yawTolerance: 15,
  safetyDistances: {
    minFrontRange: 30,
    minBottomRange: 20,
    maxAltitude: 200,
  },
  lowBatteryThreshold: 20,
  outOfBoundsLimits: {
    maxX: 500,
    maxY: 500,
    maxZ: 300,
  },
  maxSessionRuns: 100,
  hoverDuration: 500,
  mutationSizes: {
    timingCompression: 0.05,
    timingExpansion: 0.05,
    pitchRollAdjustment: 5,
    yawAdjustment: 3,
  },
  elitePoolSize: 10,
  acceptanceThreshold: 0.01,
  loggingVerbosity: 'normal',
  requiredSdkVersion: '2.5.0',
}

const DEFAULT_ELITE_MEMORY: EliteMemory = {
  sessionId: '',
  baselineRun: null,
  bestRun: null,
  elitePool: [],
  bestPerSegment: new Map(),
  recentFailedCandidates: [],
  mutationHistory: [],
  sessionSummaries: [],
  checkpointDefinitions: [],
  configSnapshots: new Map(),
}

export const useGhostlineStore = create<GhostlineStore>()(
  persist(
    (set) => ({
      // Session
      session: null,
      startSession: () =>
        set(() => ({
          session: {
            sessionId: crypto.randomUUID(),
            batteryBlockCount: 1,
            generation: 0,
            runNumber: 0,
            baselineVersion: null,
            optimizerConfigVersion: '1',
            startTimestamp: new Date().toISOString(),
            endTimestamp: null,
            cumulativeValidRuns: 0,
            cumulativeFailureCount: 0,
            cumulativeCollisionCount: 0,
            bestTimeThisSession: null,
            bestTimeAllTime: null,
            status: 'idle',
          },
        })),
      endSession: () =>
        set((state) => ({
          session: state.session
            ? { ...state.session, endTimestamp: new Date().toISOString(), status: 'idle' }
            : null,
        })),

      // Connection
      connection: {
        drone: 'disconnected',
        controller: 'disconnected',
        lastHeartbeat: null,
        errorMessage: null,
      },
      setConnection: (updates) =>
        set((state) => ({
          connection: { ...state.connection, ...updates },
        })),

      // Safety
      safety: null,
      setSafety: (safety) => set({ safety }),

      // Checkpoints
      checkpoints: [],
      addCheckpoint: (checkpoint) =>
        set((state) => ({
          checkpoints: [...state.checkpoints, checkpoint].sort((a, b) => a.orderIndex - b.orderIndex),
        })),
      updateCheckpoint: (id, updates) =>
        set((state) => ({
          checkpoints: state.checkpoints.map((cp) =>
            cp.id === id ? { ...cp, ...updates } : cp
          ),
        })),
      removeCheckpoint: (id) =>
        set((state) => ({
          checkpoints: state.checkpoints.filter((cp) => cp.id !== id),
        })),

      // Elite memory
      eliteMemory: DEFAULT_ELITE_MEMORY,
      setBaselineRun: (run) =>
        set((state) => ({
          eliteMemory: { ...state.eliteMemory, baselineRun: run },
        })),
      setBestRun: (run) =>
        set((state) => ({
          eliteMemory: { ...state.eliteMemory, bestRun: run },
        })),
      addToElitePool: (run) =>
        set((state) => {
          const pool = [...state.eliteMemory.elitePool, run]
            .sort((a, b) => a.summary.elapsedTime - b.summary.elapsedTime)
            .slice(0, state.config.elitePoolSize)
          return {
            eliteMemory: { ...state.eliteMemory, elitePool: pool },
          }
        }),

      // Config
      config: DEFAULT_CONFIG,
      setConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),

      // Current run
      currentRun: null,
      setCurrentRun: (run) => set({ currentRun: run }),
    }),
    {
      name: 'ghostline-storage',
      partialize: (state) => ({
        eliteMemory: state.eliteMemory,
        config: state.config,
        checkpoints: state.checkpoints,
      }),
    }
  )
)