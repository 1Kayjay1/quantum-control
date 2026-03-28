import type { Project } from '../core/types'

export interface Mission {
  id: string
  title: string
  workspaceId: string
  ownerId: string
  status: 'draft' | 'published'
  lastModified: Date
  duplicatedFrom?: string
  data: Project
  createdAt: Date
  members?: string[]
}
