import Dexie, { type Table } from 'dexie'

import type { Project, ProjectSummary } from '../types'

class QuantumControlDb extends Dexie {
  projects!: Table<Project, string>

  constructor() {
    super('quantum-control-db')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
    })
  }
}

export const db = new QuantumControlDb()

export async function listStoredProjects(): Promise<ProjectSummary[]> {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray()
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
  }))
}

export async function getStoredProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId)
}

export async function saveStoredProject(project: Project): Promise<void> {
  await db.projects.put(project)
}
