/**
 * Authentication and Authorization Utilities
 * 
 * This module provides centralized authentication and permission management for the Agent AI system.
 * It handles JWT token verification, user authentication, role-based access control, and resource-specific
 * permissions (agents, context documents, users, settings, RAG operations).
 * 
 * Key Features:
 * - JWT token verification with proper validation
 * - Role-based access control (admin, user)
 * - Resource-specific permissions with agent-level access control
 * - Permission checker utilities for fine-grained access control
 * - Middleware composers for common authentication patterns
 * - Input sanitization and validation for security
 */

import jwt from 'jsonwebtoken'
import User from '~/server/models/User'
import mongoose from 'mongoose'
import { sanitizeToken, sanitizeObjectId, sanitizeErrorMessage } from '~/utils/sanitize.js'

export async function requireAuth(event: any) {
  const rawToken = getCookie(event, 'access-token') || getHeader(event, 'authorization')?.replace('Bearer ', '')
  
  if (!rawToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Access token required'
    })
  }

  // Sanitize token to prevent injection attacks
  const token = sanitizeToken(rawToken)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid token format'
    })
  }

  try {
    // Verify token with same options as AuthService for consistency
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable not configured')
    }
    
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'agent-ai-server',
      audience: 'agent-ai-client'
    }) as any

    // Validate token type
    if (decoded.type !== 'access') {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token type'
      })
    }

    // Sanitize userId from token payload
    const sanitizedUserId = sanitizeObjectId(decoded.userId)
    if (!sanitizedUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token payload'
      })
    }

    const user = await User.findById(sanitizedUserId).select('-password -refreshTokens')

    if (!user || !user.isActive) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }

    // Attach user to event context
    event.context.user = user
    return user
  } catch (error: any) {
    // Sanitize error message to prevent information leakage
    const sanitizedError = sanitizeErrorMessage(error)
    console.error('Token verification error:', sanitizedError)
    
    // Don't leak specific error details to client
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid token'
    })
  }
}

export async function requireAdmin(event: any) {
  const user = event.context.user
  
  if (!user || user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }
  
  return user
}

// =============================================================================
// CENTRALIZED PERMISSION MANAGEMENT SYSTEM
// =============================================================================

/**
 * Permission types for different resources and operations
 */
export const PERMISSIONS = {
  // Agent permissions
  AGENT: {
    READ: 'agent:read',
    WRITE: 'agent:write',
    DELETE: 'agent:delete',
    CREATE: 'agent:create'
  },
  // Context document permissions
  CONTEXT: {
    READ: 'context:read',
    WRITE: 'context:write',
    DELETE: 'context:delete',
    CREATE: 'context:create'
  },
  // User management permissions
  USER: {
    READ: 'user:read',
    WRITE: 'user:write',
    DELETE: 'user:delete',
    CREATE: 'user:create'
  },
  // Settings permissions
  SETTINGS: {
    READ: 'settings:read',
    WRITE: 'settings:write'
  },
  // RAG permissions
  RAG: {
    READ: 'rag:read',
    SEARCH: 'rag:search'
  }
} as const

/**
 * Permission context for resource-specific checks
 */
export interface PermissionContext {
  agentId?: string
  userId?: string
  resourceOwnerId?: string
  [key: string]: any
}

/**
 * Permission checker interface
 */
export interface PermissionChecker {
  user: any
  hasRole(role: string): boolean
  hasAgentAccess(agentId: string): boolean
  canAccessResource(permission: string, context?: PermissionContext): boolean
}

/**
 * Create a permission checker instance for a user
 */
export function createPermissionChecker(user: any): PermissionChecker {
  return {
    user,

    hasRole(role: string): boolean {
      return user.role === role
    },

    hasAgentAccess(agentId: string): boolean {
      if (user.role === 'admin') return true
      if (!user.agentAccess || !agentId) return false
      
      // Sanitize the provided agentId for secure comparison
      const sanitizedAgentId = sanitizeObjectId(agentId)
      if (!sanitizedAgentId) return false
      
      return user.agentAccess.some((id: mongoose.Types.ObjectId) => 
        id.toString() === sanitizedAgentId
      )
    },

    canAccessResource(permission: string, context: PermissionContext = {}): boolean {
      // Admin users have access to everything
      if (user.role === 'admin') return true

      // Check permission based on type
      switch (permission) {
        // Agent permissions
        case PERMISSIONS.AGENT.READ:
        case PERMISSIONS.AGENT.WRITE:
        case PERMISSIONS.AGENT.DELETE:
          return context.agentId ? this.hasAgentAccess(context.agentId) : false

        case PERMISSIONS.AGENT.CREATE:
          return true // All authenticated users can create agents

        // Context permissions (inherit from agent permissions)
        case PERMISSIONS.CONTEXT.READ:
        case PERMISSIONS.CONTEXT.WRITE:
        case PERMISSIONS.CONTEXT.DELETE:
        case PERMISSIONS.CONTEXT.CREATE:
          return context.agentId ? this.hasAgentAccess(context.agentId) : false

        // User management permissions (admin only)
        case PERMISSIONS.USER.READ:
        case PERMISSIONS.USER.WRITE:
        case PERMISSIONS.USER.DELETE:
        case PERMISSIONS.USER.CREATE:
          return false // Only admins (already checked above)

        // Settings permissions (admin only)
        case PERMISSIONS.SETTINGS.READ:
        case PERMISSIONS.SETTINGS.WRITE:
          return false // Only admins (already checked above)

        // RAG permissions (inherit from agent permissions)
        case PERMISSIONS.RAG.READ:
        case PERMISSIONS.RAG.SEARCH:
          return context.agentId ? this.hasAgentAccess(context.agentId) : false

        default:
          return false
      }
    }
  }
}

/**
 * Centralized permission checking middleware
 * Usage: await requirePermission(event, PERMISSIONS.AGENT.READ, { agentId })
 */
export async function requirePermission(
  event: any, 
  permission: string, 
  context: PermissionContext = {}
): Promise<PermissionChecker> {
  // Ensure user is authenticated
  const user = await requireAuth(event)
  
  // Sanitize context parameters
  const sanitizedContext: PermissionContext = {}
  if (context.agentId) {
    sanitizedContext.agentId = sanitizeObjectId(context.agentId)
    if (!sanitizedContext.agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Agent ID in context'
      })
    }
  }
  if (context.userId) {
    sanitizedContext.userId = sanitizeObjectId(context.userId)
    if (!sanitizedContext.userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid User ID in context'
      })
    }
  }
  if (context.resourceOwnerId) {
    sanitizedContext.resourceOwnerId = sanitizeObjectId(context.resourceOwnerId)
    if (!sanitizedContext.resourceOwnerId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Resource Owner ID in context'
      })
    }
  }
  
  // Copy other context properties
  Object.keys(context).forEach(key => {
    if (!['agentId', 'userId', 'resourceOwnerId'].includes(key)) {
      sanitizedContext[key] = context[key]
    }
  })
  
  // Create permission checker
  const checker = createPermissionChecker(user)
  
  // Check permission
  if (!checker.canAccessResource(permission, sanitizedContext)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }
  
  return checker
}

/**
 * Agent-specific permission check (most common use case)
 * Usage: await requireAgentAccess(event, agentId, 'read')
 */
export async function requireAgentAccess(
  event: any, 
  agentId: string, 
  operation: 'read' | 'write' | 'delete' = 'read'
): Promise<PermissionChecker> {
  if (!agentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Agent ID is required'
    })
  }

  // Sanitize agent ID to prevent injection attacks
  const sanitizedAgentId = sanitizeObjectId(agentId)
  if (!sanitizedAgentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Agent ID format'
    })
  }

  const permission = operation === 'read' ? PERMISSIONS.AGENT.READ :
                    operation === 'write' ? PERMISSIONS.AGENT.WRITE :
                    PERMISSIONS.AGENT.DELETE

  return await requirePermission(event, permission, { agentId: sanitizedAgentId })
}

/**
 * Check if user has admin role
 * Usage: const checker = await requireAuthWithChecker(event); if (checker.hasRole('admin')) { ... }
 */
export async function requireAuthWithChecker(event: any): Promise<PermissionChecker> {
  const user = await requireAuth(event)
  return createPermissionChecker(user)
}

/**
 * Helper function to validate and extract agent ID from route params
 */
export function getRequiredAgentId(event: any): string {
  const rawAgentId = getRouterParam(event, 'id')
  
  if (!rawAgentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Agent ID is required'
    })
  }

  // Use sanitization utility for consistent validation
  const sanitizedAgentId = sanitizeObjectId(rawAgentId)
  
  if (!sanitizedAgentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Agent ID format'
    })
  }

  return sanitizedAgentId
}

/**
 * Middleware composer for common permission patterns
 */
export const authMiddleware = {
  /**
   * Require authentication only
   */
  auth: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    return defineEventHandler(async (event) => {
      const checker = await requireAuthWithChecker(event)
      return handler(event, checker)
    })
  },

  /**
   * Require admin role
   */
  admin: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    return defineEventHandler(async (event) => {
      await requireAuth(event)
      await requireAdmin(event)
      const checker = createPermissionChecker(event.context.user)
      return handler(event, checker)
    })
  },

  /**
   * Require agent access with operation
   */
  agentAccess: (operation: 'read' | 'write' | 'delete' = 'read') => {
    return (handler: (event: any, checker: PermissionChecker, agentId: string) => Promise<any>) => {
      return defineEventHandler(async (event) => {
        const agentId = getRequiredAgentId(event)
        const checker = await requireAgentAccess(event, agentId, operation)
        return handler(event, checker, agentId)
      })
    }
  }
} 