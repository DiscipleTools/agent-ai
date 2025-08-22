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
import axios from 'axios'
import { sanitizeToken, sanitizeObjectId, sanitizeErrorMessage, sanitizeText, sanitizeEmail, sanitizeUrl } from '~/utils/sanitize.js'

// Chatwoot authentication function
export async function requireChatwootAuth(event: any) {
  // Parse the Chatwoot session cookie
  const sessionCookie = getCookie(event, 'cw_d_session_info')
  
  if (!sessionCookie) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No Chatwoot session found. Please log into Chatwoot first.'
    })
  }

  let sessionData
  try {
    // Handle different cookie formats
    if (typeof sessionCookie === 'object') {
      sessionData = sessionCookie
    } else if (typeof sessionCookie === 'string') {
      try {
        const decodedCookie = decodeURIComponent(sessionCookie)
        sessionData = JSON.parse(decodedCookie)
      } catch (parseError) {
        sessionData = sessionCookie
      }
    } else {
      throw new Error('Unexpected cookie format')
    }
  } catch (e) {
    console.error('Error parsing session cookie:', e)
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Chatwoot session cookie format'
    })
  }

  // Extract required authentication headers
  const { 'access-token': accessToken, client, uid, expiry } = sessionData
  
  if (!accessToken || !client || !uid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Incomplete Chatwoot session data'
    })
  }

  // Get Chatwoot URL from environment (fallback to localhost)
  const chatwootInstanceUrl = process.env.CHATWOOT_URL || 'http://localhost:5600'
  const sanitizedChatwootUrl = sanitizeUrl(chatwootInstanceUrl)
  
  if (!sanitizedChatwootUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Invalid Chatwoot URL configuration'
    })
  }

  try {
    // Make request to Chatwoot API to validate session
    const profileUrl = `${sanitizedChatwootUrl.replace(/\/$/, '')}/api/v1/profile`
    
    const response = await axios.get(profileUrl, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'access-token': accessToken,
        client,
        uid,
        expiry,
      },
      validateStatus: (s) => s >= 200 && s < 500,
    })

    if (response.status !== 200) {
      console.error('Chatwoot profile API error:', response.status, response.data)
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid Chatwoot session'
      })
    }

    const profileData = response.data

    // Transform Chatwoot profile to Agent AI user format
    const userData = {
      _id: profileData.id,
      id: profileData.id,
      name: sanitizeText(profileData.name || ''),
      email: sanitizeEmail(profileData.email || ''),
      role: 'admin', // For now, all Chatwoot users are admins in Agent AI
      avatar_url: sanitizeUrl(profileData.avatar_url) || null,
      isActive: profileData.confirmed || true,
      agentAccess: [], // All agents for admin users
      chatwoot: {
        availability_status: sanitizeText(profileData.availability_status || ''),
        auto_offline: profileData.auto_offline,
        confirmed: profileData.confirmed,
        accounts: (profileData.accounts || []).map((account: any) => ({
          id: account.id,
          name: sanitizeText(account.name || ''),
          role: sanitizeText(account.role || ''),
          status: sanitizeText(account.status || ''),
        }))
      }
    }

    // Attach user to event context
    event.context.user = userData
    return userData
  } catch (error: any) {
    // Handle axios errors
    if (error.response) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Chatwoot authentication failed'
      })
    }
    
    // Re-throw createError instances
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Authentication failed'
    })
  }
}

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

// Chatwoot-specific authentication middleware
export const chatwootAuthMiddleware = {
  /**
   * Require Chatwoot authentication only
   */
  auth: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    return defineEventHandler(async (event) => {
      const user = await requireChatwootAuth(event)
      const checker = createPermissionChecker(user)
      return handler(event, checker)
    })
  },

  /**
   * Require Chatwoot authentication with admin role
   */
  admin: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    return defineEventHandler(async (event) => {
      const user = await requireChatwootAuth(event)
      if (user.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Admin access required'
        })
      }
      const checker = createPermissionChecker(user)
      return handler(event, checker)
    })
  },

  /**
   * Require Chatwoot authentication with agent access
   */
  agentAccess: (operation: 'read' | 'write' | 'delete' = 'read') => {
    return (handler: (event: any, checker: PermissionChecker, agentId: string) => Promise<any>) => {
      return defineEventHandler(async (event) => {
        const user = await requireChatwootAuth(event)
        const agentId = getRequiredAgentId(event)
        
        // Create permission checker
        const checker = createPermissionChecker(user)
        
        // Check agent access permission
        const permission = operation === 'read' ? PERMISSIONS.AGENT.READ :
                          operation === 'write' ? PERMISSIONS.AGENT.WRITE :
                          PERMISSIONS.AGENT.DELETE

        if (!checker.canAccessResource(permission, { agentId })) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Access denied'
          })
        }
        
        return handler(event, checker, agentId)
      })
    }
  }
} 