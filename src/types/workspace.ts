export type WorkspaceType = 'personal' | 'team'

export interface Workspace {
  id: string
  name: string
  ownerId: string
  members: string[]
  type: WorkspaceType
  pinnedMissionIds: string[]
  createdAt: Date
  updatedAt: Date
}
