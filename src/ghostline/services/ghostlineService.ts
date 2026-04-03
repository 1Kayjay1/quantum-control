import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'

import { db } from '../../firebase'
import type {
  GhostlineWorkspace,
  GhostlineSession,
  Checkpoint,
  RunRecord,
  OptimizerConfig,
} from '../types'

// ============================================================================
// Workspace Management
// ============================================================================

export async function getPersonalWorkspaces(userId: string): Promise<GhostlineWorkspace[]> {
  const q = query(
    collection(db, 'ghostline_workspaces'),
    where('ownerId', '==', userId),
    where('type', '==', 'personal'),
    orderBy('lastModified', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      type: data.type,
      ownerId: data.ownerId,
      teamId: data.teamId,
      createdAt: data.createdAt.toDate(),
      lastModified: data.lastModified.toDate(),
      sessionIds: data.sessionIds || [],
    }
  })
}

export async function getTeamWorkspaces(userId: string): Promise<GhostlineWorkspace[]> {
  // Get user's teams first
  const userDoc = await getDoc(doc(db, 'users', userId))
  const teamIds = userDoc.data()?.teams || []

  if (teamIds.length === 0) return []

  const q = query(
    collection(db, 'ghostline_workspaces'),
    where('type', '==', 'team'),
    where('teamId', 'in', teamIds),
    orderBy('lastModified', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      type: data.type,
      ownerId: data.ownerId,
      teamId: data.teamId,
      createdAt: data.createdAt.toDate(),
      lastModified: data.lastModified.toDate(),
      sessionIds: data.sessionIds || [],
    }
  })
}

export async function createWorkspace(
  userId: string,
  name: string,
  type: 'personal' | 'team',
  description?: string,
  teamId?: string
): Promise<GhostlineWorkspace> {
  const workspaceRef = doc(collection(db, 'ghostline_workspaces'))
  const now = Timestamp.now()

  const workspace: Record<string, unknown> = {
    name,
    type,
    ownerId: userId,
    createdAt: now,
    lastModified: now,
    sessionIds: [],
  }

  // Only add optional fields if they have values
  if (description) {
    workspace.description = description
  }
  if (teamId) {
    workspace.teamId = teamId
  }

  await setDoc(workspaceRef, workspace)

  return {
    id: workspaceRef.id,
    name,
    description,
    type,
    ownerId: userId,
    teamId,
    createdAt: now.toDate(),
    lastModified: now.toDate(),
    sessionIds: [],
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  // Delete all sessions in workspace first
  const sessions = await getSessions(workspaceId)
  await Promise.all(sessions.map((session) => deleteSession(session.id)))

  // Delete workspace
  await deleteDoc(doc(db, 'ghostline_workspaces', workspaceId))
}

// ============================================================================
// Session Management
// ============================================================================

export async function getSessions(workspaceId: string): Promise<GhostlineSession[]> {
  const q = query(
    collection(db, 'ghostline_sessions'),
    where('workspaceId', '==', workspaceId),
    orderBy('lastModified', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description,
      status: data.status,
      createdAt: data.createdAt.toDate(),
      lastModified: data.lastModified.toDate(),
      ownerId: data.ownerId,
      totalRuns: data.totalRuns || 0,
      bestTime: data.bestTime || null,
      checkpointCount: data.checkpointCount || 0,
      baselineRunId: data.baselineRunId || null,
      bestRunId: data.bestRunId || null,
    }
  })
}

export async function getSession(sessionId: string): Promise<GhostlineSession | null> {
  const sessionDoc = await getDoc(doc(db, 'ghostline_sessions', sessionId))
  if (!sessionDoc.exists()) return null

  const data = sessionDoc.data()
  return {
    id: sessionDoc.id,
    workspaceId: data.workspaceId,
    name: data.name,
    description: data.description,
    status: data.status,
    createdAt: data.createdAt.toDate(),
    lastModified: data.lastModified.toDate(),
    ownerId: data.ownerId,
    totalRuns: data.totalRuns || 0,
    bestTime: data.bestTime || null,
    checkpointCount: data.checkpointCount || 0,
    baselineRunId: data.baselineRunId || null,
    bestRunId: data.bestRunId || null,
  }
}

export async function createSession(
  workspaceId: string,
  userId: string,
  name: string,
  description?: string
): Promise<GhostlineSession> {
  const sessionRef = doc(collection(db, 'ghostline_sessions'))
  const now = Timestamp.now()

  const session: Record<string, unknown> = {
    workspaceId,
    name,
    status: 'active',
    createdAt: now,
    lastModified: now,
    ownerId: userId,
    totalRuns: 0,
    bestTime: null,
    checkpointCount: 0,
    baselineRunId: null,
    bestRunId: null,
  }

  // Only add description if provided
  if (description) {
    session.description = description
  }

  await setDoc(sessionRef, session)

  // Add session ID to workspace
  await updateDoc(doc(db, 'ghostline_workspaces', workspaceId), {
    sessionIds: arrayUnion(sessionRef.id),
    lastModified: now,
  })

  return {
    id: sessionRef.id,
    workspaceId,
    name,
    description,
    status: 'active',
    createdAt: now.toDate(),
    lastModified: now.toDate(),
    ownerId: userId,
    totalRuns: 0,
    bestTime: null,
    checkpointCount: 0,
    baselineRunId: null,
    bestRunId: null,
  }
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<GhostlineSession, 'id' | 'createdAt' | 'workspaceId' | 'ownerId'>>
): Promise<void> {
  await updateDoc(doc(db, 'ghostline_sessions', sessionId), {
    ...updates,
    lastModified: Timestamp.now(),
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessionDoc = await getDoc(doc(db, 'ghostline_sessions', sessionId))
  if (!sessionDoc.exists()) return

  const workspaceId = sessionDoc.data().workspaceId

  // Delete all checkpoints
  const checkpoints = await getCheckpoints(sessionId)
  await Promise.all(checkpoints.map((cp) => deleteCheckpoint(cp.id)))

  // Delete all runs
  const runs = await getRuns(sessionId)
  await Promise.all(runs.map((run) => deleteRun(run.summary.runId)))

  // Remove session from workspace
  await updateDoc(doc(db, 'ghostline_workspaces', workspaceId), {
    sessionIds: arrayRemove(sessionId),
    lastModified: Timestamp.now(),
  })

  // Delete session
  await deleteDoc(doc(db, 'ghostline_sessions', sessionId))
}

// ============================================================================
// Checkpoint Management
// ============================================================================

export async function getCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  const q = query(
    collection(db, 'ghostline_checkpoints'),
    where('sessionId', '==', sessionId),
    orderBy('orderIndex', 'asc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      sessionId: data.sessionId,
      label: data.label,
      x: data.x,
      y: data.y,
      z: data.z,
      radius: data.radius,
      orderIndex: data.orderIndex,
      active: data.active,
      desiredHeading: data.desiredHeading,
      headingTolerance: data.headingTolerance,
      penaltyWeight: data.penaltyWeight,
      minHeight: data.minHeight,
      minEntrySpeed: data.minEntrySpeed,
      maxEntrySpeed: data.maxEntrySpeed,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
    }
  })
}

export async function createCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<Checkpoint> {
  const checkpointRef = doc(collection(db, 'ghostline_checkpoints'))
  const now = Timestamp.now()

  const checkpointData = {
    ...checkpoint,
    createdAt: now,
  }

  await setDoc(checkpointRef, checkpointData)

  // Update session checkpoint count
  const sessionDoc = await getDoc(doc(db, 'ghostline_sessions', checkpoint.sessionId))
  const currentCount = sessionDoc.data()?.checkpointCount || 0
  await updateDoc(doc(db, 'ghostline_sessions', checkpoint.sessionId), {
    checkpointCount: currentCount + 1,
    lastModified: now,
  })

  return {
    id: checkpointRef.id,
    ...checkpoint,
    createdAt: now.toDate(),
  }
}

export async function updateCheckpoint(
  checkpointId: string,
  updates: Partial<Omit<Checkpoint, 'id' | 'sessionId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'ghostline_checkpoints', checkpointId), updates)
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  await deleteDoc(doc(db, 'ghostline_checkpoints', checkpointId))
}

// ============================================================================
// Run Management
// ============================================================================

export async function getRuns(sessionId: string, limit = 50): Promise<RunRecord[]> {
  const q = query(
    collection(db, 'ghostline_runs'),
    where('summary.sessionId', '==', sessionId),
    orderBy('summary.wallClockStart', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.slice(0, limit).map((doc) => doc.data() as RunRecord)
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const runDoc = await getDoc(doc(db, 'ghostline_runs', runId))
  if (!runDoc.exists()) return null
  return runDoc.data() as RunRecord
}

export async function saveRun(run: RunRecord): Promise<void> {
  await setDoc(doc(db, 'ghostline_runs', run.summary.runId), run)

  // Update session stats
  const session = await getSession(run.summary.sessionId)
  if (!session) return

  const updates: Partial<GhostlineSession> = {
    totalRuns: session.totalRuns + 1,
    lastModified: new Date(),
  }

  if (run.summary.isValid && run.summary.isBestSoFar) {
    updates.bestTime = run.summary.elapsedTime
    updates.bestRunId = run.summary.runId
  }

  if (run.summary.isBaseline) {
    updates.baselineRunId = run.summary.runId
  }

  await updateSession(run.summary.sessionId, updates)
}

export async function deleteRun(runId: string): Promise<void> {
  await deleteDoc(doc(db, 'ghostline_runs', runId))
}

// ============================================================================
// Configuration Management
// ============================================================================

export async function getSessionConfig(sessionId: string): Promise<OptimizerConfig | null> {
  const configDoc = await getDoc(doc(db, 'ghostline_configs', sessionId))
  if (!configDoc.exists()) return null
  return configDoc.data() as OptimizerConfig
}

export async function saveSessionConfig(sessionId: string, config: OptimizerConfig): Promise<void> {
  await setDoc(doc(db, 'ghostline_configs', sessionId), config)
}
