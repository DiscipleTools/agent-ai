/**
 * Authentication and Authorization Utilities
 * 
 * This module provides centralized authentication and permission management for the Agent AI system.
 * It handles Chatwoot session validation, role-based access control, and resource-specific
 * permissions (agents, context documents, users, settings, RAG operations).
 * 
 * Key Features:
 * - Chatwoot session validation and user authentication
 * - Role-based access control (admin, user, superadmin)
 * - Resource-specific permissions with agent-level access control
 * - Permission checker utilities for fine-grained access control
 * - Middleware composers for common authentication patterns
 * - Input sanitization and validation for security
 */

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
    console.log('profileData ---------- ')
    console.log(JSON.stringify(response.data))
    console.log(profileData.accounts)

    // Transform Chatwoot profile to Agent AI user format
    const userData = {
      _id: profileData.id,
      id: profileData.id,
      name: sanitizeText(profileData.name || ''),
      email: sanitizeEmail(profileData.email || ''),
      superadmin: profileData.type === 'SuperAdmin',
      avatar_url: sanitizeUrl(profileData.avatar_url) || null,
      isActive: profileData.confirmed || true,
      // agentAccess is now determined dynamically based on Chatwoot account administration
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

/**
 * Helper function to validate if user has admin access to specific inboxes
 * @param user - The authenticated user object
 * @param inboxes - Array of inbox assignments with accountId and inboxId
 * @returns Promise<{isValid: boolean, invalidInboxes: string[]}>
 */
export async function validateInboxPermissions(user: any, inboxes: Array<{accountId: number, inboxId: number}>): Promise<{isValid: boolean, invalidInboxes: string[]}> {
  if (!inboxes || inboxes.length === 0) {
    return { isValid: true, invalidInboxes: [] }
  }

  // Super admins can access all inboxes
  if (user.superadmin === true) {
    return { isValid: true, invalidInboxes: [] }
  }

  const userAccounts = user.chatwoot?.accounts || []
  const invalidInboxes: string[] = []

  // Check each inbox assignment
  for (const inbox of inboxes) {
    const userAccount = userAccounts.find((account: any) => account.id === inbox.accountId)
    
    if (!userAccount) {
      invalidInboxes.push(`Account ${inbox.accountId} (Inbox ${inbox.inboxId}) - No access`)
      continue
    }

    // Only allow if user is an administrator on this account
    if (userAccount.role !== 'administrator') {
      invalidInboxes.push(`Account ${inbox.accountId} (Inbox ${inbox.inboxId}) - Role '${userAccount.role}' insufficient (administrator required)`)
    }
  }

  return {
    isValid: invalidInboxes.length === 0,
    invalidInboxes
  }
}

// Legacy functions kept for compatibility with internal permission system
// These are used internally by the permission middleware but not for authentication
export async function requireAuth(event: any) {
  // This function is deprecated - use requireChatwootAuth instead
  console.warn('requireAuth is deprecated, use requireChatwootAuth instead')
  return await requireChatwootAuth(event)
}

export async function requireAdmin(event: any) {
  const user = event.context.user
  
  if (!user || (user.role !== 'admin' && !user.superadmin)) {
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
      // For Chatwoot users, check superadmin flag and admin role
      if (role === 'admin') {
        return user.superadmin === true
      }
      return user.role === role || false
    },

    hasAgentAccess(agentId: string): boolean {
      if (user.superadmin === true) return true
      if (!agentId) return false
      
      // Sanitize the provided agentId for secure comparison
      const sanitizedAgentId = sanitizeObjectId(agentId)
      if (!sanitizedAgentId) return false
      
      // For Chatwoot users, agent access is determined by whether the user
      // is an administrator of any account that the agent's inboxes belong to
      // This will be checked at the API level by fetching the agent and comparing inboxes
      return true // Allow hasAgentAccess to pass, actual check happens in canAccessAgentResource
    },

    canAccessResource(permission: string, context: PermissionContext = {}): boolean {
      // Admin users (superadmin in Chatwoot) have access to everything
      if (user.superadmin === true) return true

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
 * Check if user can access an agent based on Chatwoot account administration
 * @param user - The authenticated user object
 * @param agent - The agent object with inboxes array
 * @returns boolean - true if user can access the agent
 */
export function canAccessAgentResource(user: any, agent: any): boolean {
  // Super admins can access all agents
  if (user.superadmin === true) return true
  
  // If agent has no inboxes, only super admins can access it
  if (!agent.inboxes || agent.inboxes.length === 0) return false
  
  // Get user's administered accounts
  const userAccounts = user.chatwoot?.accounts || []
  const adminAccountIds = userAccounts
    .filter((account: any) => account.role === 'administrator')
    .map((account: any) => account.id)
  
  if (adminAccountIds.length === 0) return false
  
  // Check if any of the agent's inboxes belong to accounts the user administers
  return agent.inboxes.some((inbox: any) => 
    adminAccountIds.includes(inbox.accountId)
  )
}

/**
 * Get MongoDB query to filter agents based on user's Chatwoot account administration
 * @param user - The authenticated user object
 * @returns object - MongoDB query object
 */
export function getAgentAccessQuery(user: any): object {
  // Super admins can access all agents
  if (user.superadmin === true) return {}
  
  // Get user's administered accounts
  const userAccounts = user.chatwoot?.accounts || []
  const adminAccountIds = userAccounts
    .filter((account: any) => account.role === 'administrator')
    .map((account: any) => account.id)
  
  if (adminAccountIds.length === 0) {
    // User has no admin access to any accounts, return query that matches nothing
    return { _id: { $in: [] } }
  }
  
  // Return query that matches agents with inboxes belonging to user's administered accounts
  return {
    'inboxes.accountId': { $in: adminAccountIds }
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
 * Agent-specific permission check with database lookup (most common use case)
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

  // Authenticate user first
  const user = await requireChatwootAuth(event)
  const checker = createPermissionChecker(user)

  // Super admins have access to everything
  if (user.superadmin === true) {
    return checker
  }

  // Import Agent model here to avoid circular dependency
  const { connectDB } = await import('~/server/utils/db')
  const Agent = await import('~/server/models/Agent').then(m => m.default)
  
  // Connect to database and fetch agent
  await connectDB()
  const agent = await Agent.findById(sanitizedAgentId).select('inboxes')
  
  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Agent not found'
    })
  }

  // Check if user can access this agent based on Chatwoot account administration
  if (!canAccessAgentResource(user, agent)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }

  return checker
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
   * Require authentication only (deprecated - use chatwootAuthMiddleware)
   */
  auth: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    console.warn('authMiddleware.auth is deprecated, use chatwootAuthMiddleware.auth instead')
    return defineEventHandler(async (event) => {
      const user = await requireChatwootAuth(event)
      const checker = createPermissionChecker(user)
      return handler(event, checker)
    })
  },

  /**
   * Require admin role (deprecated - use chatwootAuthMiddleware)
   */
  admin: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    console.warn('authMiddleware.admin is deprecated, use chatwootAuthMiddleware.admin instead')
    return defineEventHandler(async (event) => {
      const user = await requireChatwootAuth(event)
      await requireAdmin(event)
      const checker = createPermissionChecker(user)
      return handler(event, checker)
    })
  },

  /**
   * Require agent access with operation (deprecated - use chatwootAuthMiddleware)
   */
  agentAccess: (operation: 'read' | 'write' | 'delete' = 'read') => {
    console.warn('authMiddleware.agentAccess is deprecated, use chatwootAuthMiddleware.agentAccess instead')
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
      if (user.superadmin !== true) {
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
   * Require Chatwoot authentication with super admin role
   */
  superAdmin: (handler: (event: any, checker: PermissionChecker) => Promise<any>) => {
    return defineEventHandler(async (event) => {
      const user = await requireChatwootAuth(event)
      
      // Check if user has super admin role in any of their accounts
      //@todo user might not be returning role yet. not on the account level
      const isSuperAdmin = user.superadmin === true
      console.log('user', user)
      
      if (!isSuperAdmin) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Super admin access required'
        })
      }
      
      const checker = createPermissionChecker(user)
      return handler(event, checker)
    })
  },

  /**
   * Require Chatwoot authentication with agent access based on account administration
   */
  agentAccess: (operation: 'read' | 'write' | 'delete' = 'read') => {
    return (handler: (event: any, checker: PermissionChecker, agentId: string) => Promise<any>) => {
      return defineEventHandler(async (event) => {
        const agentId = getRequiredAgentId(event)
        
        // Use the new requireAgentAccess function that checks Chatwoot account administration
        const checker = await requireAgentAccess(event, agentId, operation)
        
        return handler(event, checker, agentId)
      })
    }
  }
}