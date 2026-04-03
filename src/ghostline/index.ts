/**
 * Ghostline - CoDrone EDU Route Optimizer
 * 
 * This module is a self-contained feature area for autonomous route optimization.
 * It is intentionally isolated from the main Quantum Control feature area.
 */

// Domain Types
export * from './types'

// Feature metadata
export const GHOSTLINE_FEATURE = {
  name: 'Ghostline',
  version: '0.1.0',
  description: 'CoDrone EDU Route Optimizer - Teach, Refine, Repeat',
  routes: {
    landing: '/ghostline',
    workspace: '/ghostline/workspace',
  },
} as const