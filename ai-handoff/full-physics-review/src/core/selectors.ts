import type {
  BehaviorProfile,
  FieldLayout,
  FieldObject,
  InstructionBlock,
  Project,
  RouteVersion,
} from './types'

export function getActiveLayout(project: Project, layoutId: string): FieldLayout {
  return project.fieldLayouts.find((layout) => layout.id === layoutId) ?? project.fieldLayouts[0]
}

export function getActiveRoute(project: Project, routeId: string): RouteVersion {
  return project.routeVersions.find((route) => route.id === routeId) ?? project.routeVersions[0]
}

export function getCompareRoute(
  project: Project,
  routeId: string | null,
): RouteVersion | null {
  if (!routeId) {
    return null
  }

  return project.routeVersions.find((route) => route.id === routeId) ?? null
}

export function getActiveBehaviorProfile(
  project: Project,
  behaviorProfileId: string,
): BehaviorProfile {
  return (
    project.behaviorProfiles.find((profile) => profile.id === behaviorProfileId) ??
    project.behaviorProfiles[0]
  )
}

export function findFieldObject(
  layout: FieldLayout,
  objectId: string | null,
): FieldObject | null {
  if (!objectId) {
    return null
  }

  return layout.objects.find((object) => object.id === objectId) ?? null
}

export function findInstruction(
  route: RouteVersion,
  instructionId: string | null,
): InstructionBlock | null {
  if (!instructionId) {
    return null
  }

  return route.instructions.find((instruction) => instruction.id === instructionId) ?? null
}
