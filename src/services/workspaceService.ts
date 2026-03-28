import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import { createStarterProject } from '../core/sampleProject'
import { auth, db } from '../firebase'
import type { Mission } from '../types/mission'
import type { Workspace, WorkspaceType } from '../types/workspace'

const WORKSPACES_COLLECTION = 'workspaces'
const MISSIONS_COLLECTION = 'missions'

function requireCurrentUser() {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Authentication required.')
  }
  return user
}

function toDate(value: { toDate?: () => Date } | Date | null | undefined) {
  if (value instanceof Date) {
    return value
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

function normalizeWorkspaceType(data: Record<string, unknown>) {
  if (data.type === 'team') {
    return 'team' satisfies WorkspaceType
  }
  if (Array.isArray(data.members) && data.members.length > 1) {
    return 'team' satisfies WorkspaceType
  }
  return 'personal' satisfies WorkspaceType
}

function mapWorkspace(id: string, data: Record<string, unknown>): Workspace {
  return {
    id,
    name: String(data.name ?? 'Untitled Workspace'),
    ownerId: String(data.ownerId ?? ''),
    members: Array.isArray(data.members) ? data.members.map(String) : [],
    type: normalizeWorkspaceType(data),
    pinnedMissionIds: Array.isArray(data.pinnedMissionIds) ? data.pinnedMissionIds.map(String).slice(0, 5) : [],
    createdAt: toDate(data.createdAt as Date),
    updatedAt: toDate(data.updatedAt as Date),
  }
}

function mapMission(id: string, data: Record<string, unknown>): Mission {
  return {
    id,
    title: String(data.title ?? 'Untitled Mission'),
    workspaceId: String(data.workspaceId ?? ''),
    ownerId: String(data.ownerId ?? ''),
    status: data.status === 'published' ? 'published' : 'draft',
    lastModified: toDate(data.lastModified as Date),
    duplicatedFrom: typeof data.duplicatedFrom === 'string' ? data.duplicatedFrom : undefined,
    data: (data.data ?? createStarterProject()) as Mission['data'],
    createdAt: toDate(data.createdAt as Date),
    members: Array.isArray(data.members) ? data.members.map(String) : [],
  }
}

async function createWorkspaceDocument(name: string, type: WorkspaceType): Promise<Workspace> {
  const user = requireCurrentUser()
  const workspaceRef = await addDoc(collection(db, WORKSPACES_COLLECTION), {
    name,
    ownerId: user.uid,
    members: [user.uid],
    type,
    pinnedMissionIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const workspaceDoc = await getDoc(workspaceRef)
  return mapWorkspace(workspaceDoc.id, workspaceDoc.data() ?? {})
}

async function ensurePersonalWorkspace(): Promise<Workspace> {
  const user = requireCurrentUser()
  const existing = await getDocs(
    query(
      collection(db, WORKSPACES_COLLECTION),
      where('ownerId', '==', user.uid),
      where('type', '==', 'personal'),
    ),
  )

  const first = existing.docs[0]
  if (first) {
    return mapWorkspace(first.id, first.data())
  }

  return createWorkspaceDocument('Personal Workspace', 'personal')
}

function canAccessWorkspace(workspace: Workspace, userId: string) {
  return workspace.type === 'team' || workspace.ownerId === userId || workspace.members.includes(userId)
}

function canCreateMissionInWorkspace(workspace: Workspace, userId: string) {
  return workspace.type === 'team' || workspace.ownerId === userId || workspace.members.includes(userId)
}

function canPinWorkspace(workspace: Workspace, userId: string) {
  return workspace.type === 'team' || workspace.ownerId === userId || workspace.members.includes(userId)
}

export const workspaceService = {
  async getPersonalWorkspaces(): Promise<Workspace[]> {
    const user = requireCurrentUser()
    const snapshot = await getDocs(
      query(
        collection(db, WORKSPACES_COLLECTION),
        where('ownerId', '==', user.uid),
        where('type', '==', 'personal'),
      ),
    )

    const workspaces = snapshot.docs
      .map((entry) => mapWorkspace(entry.id, entry.data()))
      .sort((left, right) => left.name.localeCompare(right.name))

    if (workspaces.length > 0) {
      return workspaces
    }

    return [await ensurePersonalWorkspace()]
  },

  async getTeamWorkspaces(): Promise<Workspace[]> {
    const snapshot = await getDocs(
      query(collection(db, WORKSPACES_COLLECTION), where('type', '==', 'team')),
    )

    return snapshot.docs
      .map((entry) => mapWorkspace(entry.id, entry.data()))
      .sort((left, right) => left.name.localeCompare(right.name))
  },

  async getWorkspaces(): Promise<Workspace[]> {
    const [personal, team] = await Promise.all([
      this.getPersonalWorkspaces(),
      this.getTeamWorkspaces(),
    ])

    return [...personal, ...team]
  },

  async createWorkspace(name: string, type: WorkspaceType): Promise<Workspace> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Workspace name is required.')
    }

    return createWorkspaceDocument(trimmed, type)
  },

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const snapshot = await getDoc(doc(db, WORKSPACES_COLLECTION, workspaceId))
    if (!snapshot.exists()) {
      return null
    }

    return mapWorkspace(snapshot.id, snapshot.data())
  },

  async getDefaultPersonalWorkspace(): Promise<Workspace> {
    const workspaces = await this.getPersonalWorkspaces()
    return workspaces[0] ?? ensurePersonalWorkspace()
  },

  async getMissions(workspaceId: string): Promise<Mission[]> {
    const user = requireCurrentUser()
    const workspace = await this.getWorkspace(workspaceId)
    if (!workspace || !canAccessWorkspace(workspace, user.uid)) {
      throw new Error('Workspace not found or unavailable.')
    }

    const snapshot = await getDocs(
      query(collection(db, MISSIONS_COLLECTION), where('workspaceId', '==', workspaceId)),
    )

    return snapshot.docs
      .map((entry) => mapMission(entry.id, entry.data()))
      .sort((left, right) => right.lastModified.getTime() - left.lastModified.getTime())
  },

  async getMission(missionId: string): Promise<Mission | null> {
    const snapshot = await getDoc(doc(db, MISSIONS_COLLECTION, missionId))
    if (!snapshot.exists()) {
      return null
    }

    return mapMission(snapshot.id, snapshot.data())
  },

  async createMission(workspaceId: string, title: string): Promise<Mission> {
    const user = requireCurrentUser()
    const workspace = await this.getWorkspace(workspaceId)
    if (!workspace || !canCreateMissionInWorkspace(workspace, user.uid)) {
      throw new Error('You do not have permission to create a mission here.')
    }

    const project = createStarterProject()
    project.name = title
    project.updatedAt = new Date().toISOString()

    const missionRef = await addDoc(collection(db, MISSIONS_COLLECTION), {
      title,
      workspaceId,
      ownerId: user.uid,
      status: 'draft',
      lastModified: serverTimestamp(),
      createdAt: serverTimestamp(),
      members: [user.uid],
      data: project,
    })

    const snapshot = await getDoc(missionRef)
    return mapMission(snapshot.id, snapshot.data() ?? {})
  },

  async updateMission(missionId: string, data: Partial<Mission>): Promise<void> {
    const user = requireCurrentUser()
    const mission = await this.getMission(missionId)
    if (!mission) {
      throw new Error('Mission not found.')
    }
    if (mission.ownerId !== user.uid) {
      throw new Error('Only the mission creator can edit this mission.')
    }

    const patch: Record<string, unknown> = {
      ...data,
      lastModified: serverTimestamp(),
    }

    delete patch.createdAt
    delete patch.id
    delete patch.ownerId

    await updateDoc(doc(db, MISSIONS_COLLECTION, missionId), patch)
  },

  async deleteMission(missionId: string): Promise<void> {
    const user = requireCurrentUser()
    const mission = await this.getMission(missionId)
    if (!mission) {
      throw new Error('Mission not found.')
    }
    if (mission.ownerId !== user.uid) {
      throw new Error('Only the mission creator can delete this mission.')
    }

    await deleteDoc(doc(db, MISSIONS_COLLECTION, missionId))
  },

  async duplicateMission(missionId: string, destinationWorkspaceId?: string): Promise<Mission> {
    const source = await this.getMission(missionId)
    if (!source) {
      throw new Error('Mission not found.')
    }

    const user = requireCurrentUser()
    const destinationWorkspace = destinationWorkspaceId
      ? await this.getWorkspace(destinationWorkspaceId)
      : await this.getDefaultPersonalWorkspace()

    if (!destinationWorkspace || !canCreateMissionInWorkspace(destinationWorkspace, user.uid)) {
      throw new Error('Destination workspace is unavailable.')
    }

    const duplicatedProject = structuredClone(source.data)
    duplicatedProject.name = `${source.title} Copy`
    duplicatedProject.updatedAt = new Date().toISOString()

    const duplicateRef = await addDoc(collection(db, MISSIONS_COLLECTION), {
      title: `${source.title} Copy`,
      workspaceId: destinationWorkspace.id,
      ownerId: user.uid,
      status: 'draft',
      duplicatedFrom: source.id,
      lastModified: serverTimestamp(),
      createdAt: serverTimestamp(),
      members: [user.uid],
      data: duplicatedProject,
    })

    const snapshot = await getDoc(duplicateRef)
    return mapMission(snapshot.id, snapshot.data() ?? {})
  },

  async togglePinnedMission(workspaceId: string, missionId: string): Promise<string[]> {
    const user = requireCurrentUser()
    const workspace = await this.getWorkspace(workspaceId)
    if (!workspace || !canPinWorkspace(workspace, user.uid)) {
      throw new Error('Workspace not found or unavailable.')
    }

    const isPinned = workspace.pinnedMissionIds.includes(missionId)
    const nextPinnedMissionIds = isPinned
      ? workspace.pinnedMissionIds.filter((id) => id !== missionId)
      : [missionId, ...workspace.pinnedMissionIds].slice(0, 5)

    if (!isPinned && workspace.pinnedMissionIds.length >= 5) {
      throw new Error('You can pin up to 5 missions per workspace.')
    }

    await updateDoc(doc(db, WORKSPACES_COLLECTION, workspaceId), {
      pinnedMissionIds: nextPinnedMissionIds,
      updatedAt: serverTimestamp(),
    })

    return nextPinnedMissionIds
  },
}
