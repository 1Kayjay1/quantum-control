import {
  DEFAULT_FIELD_HEIGHT_CM,
  DEFAULT_FIELD_LENGTH_CM,
  DEFAULT_FIELD_WIDTH_CM,
} from './constants'
import { createId } from './id'
import { createFieldObject, createInstructionBlock } from './presets'
import type { BehaviorProfile, FieldLayout, Project, RouteVersion } from './types'

function createBaselineRoute(): RouteVersion {
  const instructions = [
    createInstructionBlock('takeoff'),
    {
      ...createInstructionBlock('moveForward'),
      strength: 68,
      duration: 1.7,
      note: 'Push through the start lane with a forward pitch burst.',
    },
    { ...createInstructionBlock('hover'), duration: 0.6, note: 'Stabilize before the gate entry.' },
    {
      ...createInstructionBlock('rotateCW'),
      strength: 54,
      duration: 0.8,
      note: 'Hold yaw right until the ring is centered.',
    },
    {
      ...createInstructionBlock('moveForward'),
      strength: 56,
      duration: 1.2,
      note: 'Thread the ring with a moderate forward input.',
    },
    {
      ...createInstructionBlock('strafeRight'),
      strength: 44,
      duration: 0.9,
      note: 'Slide right to line up with the scoring zone.',
    },
    {
      ...createInstructionBlock('moveDown'),
      strength: 36,
      duration: 0.45,
      note: 'Bleed altitude before the finish lane.',
    },
    createInstructionBlock('land'),
  ]

  return {
    id: createId('route'),
    name: 'Route A - Baseline',
    description: 'Balanced first-pass route for a clean gate-to-ring line.',
    timingResolution: 0.3,
    instructions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createSafeRoute(): RouteVersion {
  const instructions = [
    createInstructionBlock('takeoff'),
    {
      ...createInstructionBlock('moveForward'),
      strength: 54,
      duration: 1.35,
      note: 'Shorter opening leg with a calmer pitch input.',
    },
    { ...createInstructionBlock('hover'), duration: 0.9, note: 'Give the drone extra time to settle.' },
    {
      ...createInstructionBlock('rotateCW'),
      strength: 42,
      duration: 0.95,
      note: 'Softer yaw input to reduce overshoot.',
    },
    {
      ...createInstructionBlock('moveForward'),
      strength: 48,
      duration: 1.05,
      note: 'Conservative pitch forward through the ring.',
    },
    { ...createInstructionBlock('hover'), duration: 0.6, note: 'Recenter before the scoring slide.' },
    {
      ...createInstructionBlock('strafeRight'),
      strength: 38,
      duration: 0.72,
      note: 'Shorter roll-right burst toward the finish.',
    },
    createInstructionBlock('land'),
  ]

  return {
    id: createId('route'),
    name: 'Route B - Safer',
    description: 'Lower-risk variant with added hover buffers and reduced speeds.',
    timingResolution: 0.3,
    instructions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createBaselineBehavior(): BehaviorProfile {
  return {
    id: createId('profile'),
    name: 'Practice Drift',
    massKg: 0.0584,
    hoverAssistPct: 1,
    altitudeHoldGain: 5.8,
    attitudeHoldGain: 1,
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
    randomizeConditions: true,
    randomizationPct: 0.45,
    gustStrengthCmS2: 12,
    propWashStrength: 1.2,
    objectDraftStrength: 0.22,
  }
}

function createCalmBehavior(): BehaviorProfile {
  return {
    id: createId('profile'),
    name: 'Calm Conditions',
    massKg: 0.0548,
    hoverAssistPct: 1,
    altitudeHoldGain: 6.4,
    attitudeHoldGain: 1.05,
    driftLateralCmPerMeter: 2.5,
    driftForwardCmPerMeter: 1,
    driftVerticalCmPerMeter: 0.5,
    dragPct: 0.03,
    overshootPct: 0.01,
    underTravelPct: 0.01,
    turnDelayMs: 90,
    reactionDelayMs: 60,
    speedVariationPct: 0.04,
    accelerationCurve: 0.9,
    decelerationCurve: 0.88,
    turnResponsePct: 0.97,
    randomizeConditions: true,
    randomizationPct: 0.12,
    gustStrengthCmS2: 10,
    propWashStrength: 0.34,
    objectDraftStrength: 0.18,
  }
}

function createDraftyGymBehavior(): BehaviorProfile {
  return {
    id: createId('profile'),
    name: 'Drafty Gym',
    massKg: 0.0584,
    hoverAssistPct: 0.98,
    altitudeHoldGain: 5.5,
    attitudeHoldGain: 0.96,
    driftLateralCmPerMeter: 7.5,
    driftForwardCmPerMeter: 2.8,
    driftVerticalCmPerMeter: 1.6,
    dragPct: 0.08,
    overshootPct: 0.04,
    underTravelPct: 0.02,
    turnDelayMs: 220,
    reactionDelayMs: 140,
    speedVariationPct: 0.1,
    accelerationCurve: 0.82,
    decelerationCurve: 0.76,
    turnResponsePct: 0.9,
    randomizeConditions: true,
    randomizationPct: 0.16,
    gustStrengthCmS2: 22,
    propWashStrength: 0.46,
    objectDraftStrength: 0.3,
  }
}

function createVariableAirBehavior(): BehaviorProfile {
  return {
    id: createId('profile'),
    name: 'Variable Air',
    massKg: 0.0566,
    hoverAssistPct: 1,
    altitudeHoldGain: 5.9,
    attitudeHoldGain: 1,
    driftLateralCmPerMeter: 5.5,
    driftForwardCmPerMeter: 2.2,
    driftVerticalCmPerMeter: 1.1,
    dragPct: 0.07,
    overshootPct: 0.035,
    underTravelPct: 0.025,
    turnDelayMs: 210,
    reactionDelayMs: 125,
    speedVariationPct: 0.09,
    accelerationCurve: 0.83,
    decelerationCurve: 0.79,
    turnResponsePct: 0.92,
    randomizeConditions: true,
    randomizationPct: 0.24,
    gustStrengthCmS2: 18,
    propWashStrength: 0.44,
    objectDraftStrength: 0.24,
  }
}

function createStressTestBehavior(): BehaviorProfile {
  return {
    id: createId('profile'),
    name: 'Stress Test',
    massKg: 0.0584,
    hoverAssistPct: 0.96,
    altitudeHoldGain: 5.1,
    attitudeHoldGain: 0.92,
    driftLateralCmPerMeter: 10,
    driftForwardCmPerMeter: 4,
    driftVerticalCmPerMeter: 2.2,
    dragPct: 0.11,
    overshootPct: 0.06,
    underTravelPct: 0.035,
    turnDelayMs: 280,
    reactionDelayMs: 180,
    speedVariationPct: 0.14,
    accelerationCurve: 0.78,
    decelerationCurve: 0.72,
    turnResponsePct: 0.86,
    randomizeConditions: true,
    randomizationPct: 0.34,
    gustStrengthCmS2: 30,
    propWashStrength: 0.55,
    objectDraftStrength: 0.38,
  }
}

function createFieldLayout(): FieldLayout {
  const wall = createFieldObject('wall')
  wall.position = { x: 60, y: 60, z: -100 }
  wall.size = { x: 20, y: 120, z: 220 }

  const gate = createFieldObject('gate')
  gate.position = { x: 150, y: 60, z: 0 }
  gate.checkpointOrder = 1

  const ring = createFieldObject('ring')
  ring.position = { x: 240, y: 80, z: 120 }
  ring.checkpointOrder = 2

  const scoringZone = createFieldObject('scoringZone')
  scoringZone.position = { x: 310, y: 2, z: 120 }
  scoringZone.scoreValue = 25
  scoringZone.checkpointOrder = 3

  const landingZone = createFieldObject('landingZone')
  landingZone.position = { x: 320, y: 2, z: 200 }
  landingZone.scoreValue = 15
  landingZone.checkpointOrder = 4

  const marker = createFieldObject('marker')
  marker.position = { x: 0, y: 20, z: 0 }
  marker.note = 'Start reference marker'

  return {
    id: createId('layout'),
    name: 'Qualifier Field',
    width: DEFAULT_FIELD_WIDTH_CM,
    length: DEFAULT_FIELD_LENGTH_CM,
    height: DEFAULT_FIELD_HEIGHT_CM,
    objects: [wall, gate, ring, scoringZone, landingZone, marker],
    spawn: {
      position: { x: -180, y: 0, z: -120 },
      heading: 0,
    },
    notes: 'Baseline interpretation of the autonomous round field.',
  }
}

function createAlternateLayout(): FieldLayout {
  const layout = createFieldLayout()
  layout.id = createId('layout')
  layout.name = 'Qualifier Field - Tight Gate'
  layout.objects = layout.objects.map((object) => {
    if (object.type === 'gate') {
      return {
        ...object,
        position: { x: 160, y: object.position.y, z: -20 },
      }
    }

    return object
  })
  layout.notes = 'Gate offset used to test stricter approach spacing.'
  return layout
}

export function createStarterProject(): Project {
  return {
    id: createId('project'),
    name: 'Quantum Control Demo',
    description:
      'Student-built autonomous planning workspace with route testing, drift simulation, and manual export.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fieldLayouts: [createFieldLayout(), createAlternateLayout()],
    routeVersions: [createBaselineRoute(), createSafeRoute()],
    behaviorProfiles: [
      createBaselineBehavior(),
      createCalmBehavior(),
      createDraftyGymBehavior(),
      createVariableAirBehavior(),
      createStressTestBehavior(),
    ],
  }
}
