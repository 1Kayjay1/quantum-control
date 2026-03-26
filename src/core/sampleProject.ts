import {
  DEFAULT_FIELD_HEIGHT_CM,
  DEFAULT_FIELD_LENGTH_CM,
  DEFAULT_FIELD_WIDTH_CM,
  OFFICIAL_FIELD_DIMENSIONS_CM,
} from './constants'
import { createId } from './id'
import { createFieldObject, createInstructionBlock, createMissionCheckpoint } from './presets'
import type { BehaviorProfile, FieldLayout, Project, RouteVersion } from './types'

function createBaselineRoute(): RouteVersion {
  const instructions = [
    createInstructionBlock('takeoff'),
    { ...createInstructionBlock('moveForward'), strength: 64, duration: 1.2, note: 'Clear the launch lane and line up for the arch.' },
    { ...createInstructionBlock('hover'), duration: 0.4 },
    { ...createInstructionBlock('moveForward'), strength: 52, duration: 1.05, note: 'Carry through the keyhole gate.' },
    { ...createInstructionBlock('strafeRight'), strength: 42, duration: 0.75, note: 'Shift for the tunnel entry.' },
    { ...createInstructionBlock('moveForward'), strength: 48, duration: 0.9, note: 'Commit through the tunnel.' },
    { ...createInstructionBlock('moveDown'), strength: 30, duration: 0.35, note: 'Dip toward the color mat sightline.' },
    { ...createInstructionBlock('hover'), duration: 0.5, note: 'Hold over the color mat for detection.' },
    { ...createInstructionBlock('moveForward'), strength: 46, duration: 0.9, note: 'Pass through the panel section.' },
    createInstructionBlock('land'),
  ]

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
  const instructions = [
    createInstructionBlock('takeoff'),
    { ...createInstructionBlock('hover'), duration: 0.4 },
    { ...createInstructionBlock('moveForward'), strength: 56, duration: 1.05, note: 'Shorter first leg under the arch.' },
    { ...createInstructionBlock('hover'), duration: 0.6 },
    { ...createInstructionBlock('moveForward'), strength: 46, duration: 0.9, note: 'Ease through the keyhole.' },
    { ...createInstructionBlock('strafeRight'), strength: 36, duration: 0.68, note: 'Shift calmly into the tunnel lane.' },
    { ...createInstructionBlock('moveForward'), strength: 42, duration: 0.84, note: 'Controlled tunnel pass.' },
    { ...createInstructionBlock('hover'), duration: 0.6, note: 'Stabilize over the color mat.' },
    { ...createInstructionBlock('moveForward'), strength: 40, duration: 0.78, note: 'Final panel approach.' },
    createInstructionBlock('land'),
  ]

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
  const archGate = createFieldObject('archGate')
  archGate.position = { x: -140, y: OFFICIAL_FIELD_DIMENSIONS_CM.archGate.outerHeight * 0.5, z: -30 }

  const keyholeGate = createFieldObject('keyholeGate')
  keyholeGate.position = { x: -20, y: 82, z: -20 }

  const tunnel = createFieldObject('tunnel')
  tunnel.position = { x: 70, y: 74, z: -10 }
  tunnel.rotation.y = 90

  const colorMat = createFieldObject('colorMat')
  colorMat.position = { x: 55, y: colorMat.size.y * 0.5, z: 68 }
  colorMat.colorTag = 'blue'

  const panel = createFieldObject('flyThroughPanel')
  panel.position = { x: 148, y: panel.size.y * 0.5, z: 10 }

  const landingPad = createFieldObject('landingPad')
  landingPad.position = { x: 215, y: landingPad.size.y * 0.5, z: 120 }

  const cubeSmall = createFieldObject('cubeSmall')
  cubeSmall.position = { x: 200, y: cubeSmall.size.y * 0.5, z: 182 }

  const cubeLarge = createFieldObject('cubeLarge')
  cubeLarge.position = { x: 248, y: cubeLarge.size.y * 0.5, z: 168 }

  const pillar = createFieldObject('pillar')
  pillar.position = { x: 112, y: pillar.size.y * 0.5, z: 118 }

  const miniArch = createFieldObject('miniArchGate')
  miniArch.position = { x: 230, y: miniArch.size.y * 0.5, z: 32 }

  const missionCheckpoints = [
    createMissionCheckpoint(archGate, {
      order: 1,
      label: 'Under Arch Gate',
      checkpointType: 'archGate',
      passCondition: 'flyUnder',
      note: 'Pass under the official arch opening.',
    }),
    createMissionCheckpoint(keyholeGate, {
      order: 2,
      label: 'Through Keyhole Gate',
      checkpointType: 'keyholeGate',
      passCondition: 'flyThrough',
    }),
    createMissionCheckpoint(tunnel, {
      order: 3,
      label: 'Through Tunnel',
      checkpointType: 'tunnel',
      passCondition: 'flyThrough',
    }),
    createMissionCheckpoint(colorMat, {
      order: 4,
      label: 'Detect Blue Color Mat',
      checkpointType: 'colorMat',
      passCondition: 'detectColor',
      note: 'Enter the blue mat trigger zone.',
    }),
    createMissionCheckpoint(panel, {
      order: 5,
      label: 'Through Panel',
      checkpointType: 'flyThroughPanel',
      passCondition: 'flyThrough',
    }),
    createMissionCheckpoint(miniArch, {
      order: 6,
      label: 'Mini Arch Bonus',
      checkpointType: 'miniArchGate',
      passCondition: 'flyThrough',
      required: false,
      note: 'Optional bonus checkpoint.',
    }),
    createMissionCheckpoint(landingPad, {
      order: 7,
      label: 'Landing',
      checkpointType: 'landingPad',
      passCondition: 'landOn',
      note: 'Landing only counts after all required checkpoints are complete.',
    }),
  ]

  return {
    id: createId('layout'),
    name: 'ADC Autonomous Mission',
    width: DEFAULT_FIELD_WIDTH_CM,
    length: DEFAULT_FIELD_LENGTH_CM,
    height: DEFAULT_FIELD_HEIGHT_CM,
    objects: [archGate, keyholeGate, tunnel, colorMat, panel, landingPad, cubeSmall, cubeLarge, pillar, miniArch],
    missionCheckpoints,
    spawn: {
      position: { x: -220, y: 0, z: -120 },
      heading: 0,
    },
    notes: 'Official-sized mission elements with ordered autonomous checkpoint logic.',
  }
}

function createTightVariantLayout(): FieldLayout {
  const layout = createOfficialMissionLayout()
  layout.id = createId('layout')
  layout.name = 'ADC Mission - Tight Right Variant'
  layout.objects = layout.objects.map((object) => {
    if (object.type === 'keyholeGate') {
      return {
        ...object,
        position: { ...object.position, z: -40 },
      }
    }
    if (object.type === 'tunnel') {
      return {
        ...object,
        position: { ...object.position, z: -36 },
      }
    }
    return object
  })
  layout.missionCheckpoints = layout.missionCheckpoints.map((checkpoint) => {
    const matchingObject = layout.objects.find((object) => object.id === checkpoint.objectId)
    return matchingObject
      ? { ...checkpoint, objectId: matchingObject.id }
      : checkpoint
  })
  layout.notes = 'Alternate interpretation with a tighter right-side tunnel alignment.'
  return layout
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
