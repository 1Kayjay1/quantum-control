import {
  DEFAULT_FIELD_HEIGHT_CM,
  DEFAULT_FIELD_LENGTH_CM,
  DEFAULT_FIELD_WIDTH_CM,
} from './constants'
import { createId } from './id'
import type { BehaviorProfile, FieldLayout, Project, RouteVersion } from './types'

function createBaselineRoute(): RouteVersion {
  // Empty route - user starts with clean slate
  const instructions: any[] = []

  return {
    id: createId('route'),
    name: 'Route A - Baseline',
    description: 'Nominal autonomous mission route through the official field elements.',
    timingResolution: 0.3,
    instructions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createSafeRoute(): RouteVersion {
  // Empty route - user starts with clean slate
  const instructions: any[] = []

  return {
    id: createId('route'),
    name: 'Route B - Safer',
    description: 'Conservative variant with extra settle windows before mission elements.',
    timingResolution: 0.3,
    instructions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createBehavior(
  overrides: Partial<BehaviorProfile>,
  name: string,
): BehaviorProfile {
  return {
    id: createId('profile'),
    name,
    massKg: 0.0584,
    hoverAssistPct: 1,
    hoverBrakeAssistPct: 0.56,
    altitudeHoldGain: 5.8,
    attitudeHoldGain: 1,
    referenceVelocityBlend: 0.18,
    referencePositionGain: 0.25,
    referenceHeadingAssist: 0.58,
    driftLateralCmPerMeter: 5,
    driftForwardCmPerMeter: 3,
    driftVerticalCmPerMeter: 1.2,
    dragPct: 0.06,
    overshootPct: 0,
    underTravelPct: 0.02,
    turnDelayMs: 180,
    reactionDelayMs: 120,
    speedVariationPct: 0.18,
    accelerationCurve: 0.84,
    decelerationCurve: 0.78,
    turnResponsePct: 0.93,
    carryPct: 0.36,
    coastDurationMs: 420,
    referenceAssistDuringCoastPct: 0.24,
    randomizeConditions: true,
    randomizationPct: 0.45,
    gustStrengthCmS2: 12,
    propWashStrength: 1.2,
    objectDraftStrength: 0.22,
    ...overrides,
  }
}

function createOfficialMissionLayout(): FieldLayout {
  // Empty layout - user starts with clean slate, just the drone
  return {
    id: createId('layout'),
    name: 'ADC Autonomous Mission',
    width: DEFAULT_FIELD_WIDTH_CM,
    length: DEFAULT_FIELD_LENGTH_CM,
    height: DEFAULT_FIELD_HEIGHT_CM,
    objects: [],
    missionCheckpoints: [],
    spawn: {
      position: { x: -220, y: 0, z: -120 },
      heading: 0,
    },
    notes: 'Official-sized mission elements with ordered autonomous checkpoint logic.',
  }
}

function createTightVariantLayout(): FieldLayout {
  // Empty layout - user starts with clean slate
  return {
    id: createId('layout'),
    name: 'ADC Mission - Tight Right Variant',
    width: DEFAULT_FIELD_WIDTH_CM,
    length: DEFAULT_FIELD_LENGTH_CM,
    height: DEFAULT_FIELD_HEIGHT_CM,
    objects: [],
    missionCheckpoints: [],
    spawn: {
      position: { x: -220, y: 0, z: -120 },
      heading: 0,
    },
    notes: 'Alternate interpretation with a tighter right-side tunnel alignment.',
  }
}

export function createStarterProject(): Project {
  return {
    id: createId('project'),
    name: 'Quantum Control Demo',
    description: 'Rule-aware autonomous planning workspace for the Aerial Drone Competition mission field.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fieldLayouts: [createOfficialMissionLayout(), createTightVariantLayout()],
    routeVersions: [createBaselineRoute(), createSafeRoute()],
    behaviorProfiles: [
      createBehavior({}, 'Practice Drift'),
      createBehavior({
        massKg: 0.0548,
        dragPct: 0.03,
        speedVariationPct: 0.04,
        referenceVelocityBlend: 0.14,
        referencePositionGain: 0.2,
        referenceHeadingAssist: 0.5,
        driftLateralCmPerMeter: 2.5,
        driftForwardCmPerMeter: 1,
        driftVerticalCmPerMeter: 0.5,
        carryPct: 0.28,
        coastDurationMs: 320,
        randomizationPct: 0.12,
      }, 'Calm Conditions'),
      createBehavior({
        driftLateralCmPerMeter: 7.5,
        driftForwardCmPerMeter: 2.8,
        driftVerticalCmPerMeter: 1.6,
        dragPct: 0.08,
        turnDelayMs: 220,
        gustStrengthCmS2: 22,
        referenceVelocityBlend: 0.16,
        referencePositionGain: 0.22,
        referenceHeadingAssist: 0.54,
        carryPct: 0.42,
        coastDurationMs: 480,
      }, 'Drafty Gym'),
      createBehavior({
        massKg: 0.0566,
        driftLateralCmPerMeter: 5.5,
        driftForwardCmPerMeter: 2.2,
        driftVerticalCmPerMeter: 1.1,
        dragPct: 0.07,
        turnDelayMs: 210,
        randomizationPct: 0.24,
        gustStrengthCmS2: 18,
        referenceVelocityBlend: 0.15,
        referencePositionGain: 0.2,
        referenceHeadingAssist: 0.48,
      }, 'Variable Air'),
      createBehavior({
        hoverAssistPct: 0.96,
        hoverBrakeAssistPct: 0.68,
        altitudeHoldGain: 5.1,
        attitudeHoldGain: 0.92,
        referenceVelocityBlend: 0.1,
        referencePositionGain: 0.16,
        referenceHeadingAssist: 0.42,
        driftLateralCmPerMeter: 10,
        driftForwardCmPerMeter: 4,
        driftVerticalCmPerMeter: 2.2,
        dragPct: 0.11,
        turnDelayMs: 280,
        reactionDelayMs: 180,
        speedVariationPct: 0.14,
        carryPct: 0.48,
        coastDurationMs: 560,
        randomizationPct: 0.34,
        gustStrengthCmS2: 30,
        objectDraftStrength: 0.38,
      }, 'Stress Test'),
    ],
  }
}
