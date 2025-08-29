/**
 * Agent Creation API Endpoint
 * 
 * POST /api/agents
 * 
 * Creates a new AI agent with the provided configuration.
 * Validates and sanitizes all user inputs to prevent XSS, injection attacks,
 * and other security vulnerabilities. Grants appropriate access permissions
 * to the creating user.
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware, validateInboxPermissions } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
// User model removed - using Chatwoot authentication
import { sanitizeText, sanitizeContent, sanitizeNumber, sanitizeObjectId } from '~/utils/sanitize'
import chatwootService from '~/server/services/chatwootService'

interface AgentSettings {
  temperature?: number | string
  maxTokens?: number | string
  responseDelay?: number | string
  connectionId?: string
  modelId?: string
}

interface AgentRequestBody {
  name?: string
  description?: string
  prompt?: string
  agentType?: string
  settings?: AgentSettings
  inboxes?: Array<{
    accountId: number
    inboxId: number
    accountName?: string
    inboxName?: string
    channelType?: string
  }>
}

// Helper function to extract Chatwoot session data from event
function extractUserSessionData(event: any): { 'access-token': string; client: string; uid: string; expiry?: string } | null {
  try {
    const sessionCookie = getCookie(event, 'cw_d_session_info')
    
    if (!sessionCookie) {
      return null
    }

    let sessionData
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
      return null
    }

    const { 'access-token': accessToken, client, uid, expiry } = sessionData
    
    if (!accessToken || !client || !uid) {
      return null
    }

    return { 'access-token': accessToken, client, uid, expiry }
  } catch (error) {
    console.error('Error extracting user session data:', error)
    return null
  }
}

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get user from checker
    const user = checker.user

    // Get request body
    const body = await readBody(event) as AgentRequestBody

    // Sanitize individual fields with proper typing
    const sanitizedBody = {
      name: sanitizeText(body.name),
      description: sanitizeContent(body.description),
      prompt: sanitizeContent(body.prompt),
      agentType: sanitizeText(body.agentType) || 'response'
    }

    // Enhanced validation with sanitized inputs
    const errors = []

    // Validate name
    if (!sanitizedBody.name || !sanitizedBody.name.trim()) {
      errors.push('Agent name is required')
    } else if (sanitizedBody.name.length > 100) {
      errors.push('Agent name cannot exceed 100 characters')
    }

    // Validate prompt
    if (!sanitizedBody.prompt || !sanitizedBody.prompt.trim()) {
      errors.push('System prompt is required')
    } else if (sanitizedBody.prompt.length < 10) {
      errors.push('Prompt must be at least 10 characters long')
    } else if (sanitizedBody.prompt.length > 2000) {
      errors.push('Prompt cannot exceed 2000 characters')
    }

    // Validate description
    if (sanitizedBody.description && sanitizedBody.description.length > 500) {
      errors.push('Description cannot exceed 500 characters')
    }

    // Validate agent type
    const validAgentTypes = ['response', 'pre-process', 'analytics', 'moderation', 'routing', 'post-process']
    if (!validAgentTypes.includes(sanitizedBody.agentType)) {
      errors.push(`Invalid agent type. Must be: ${validAgentTypes.join(', ')}`)
    }



    // Validate settings with additional sanitization
    const sanitizedSettings: {
      temperature?: number
      maxTokens?: number
      responseDelay?: number
      connectionId?: string | null
      modelId?: string | null
    } = {}

    if (body.settings) {
      // Sanitize and validate temperature
      if (body.settings.temperature !== undefined) {
        const temp = sanitizeNumber(body.settings.temperature)
        if (temp < 0 || temp > 1) {
          errors.push('Temperature must be between 0 and 1')
        }
        sanitizedSettings.temperature = temp
      }

      // Sanitize and validate maxTokens
      if (body.settings.maxTokens !== undefined) {
        const tokens = sanitizeNumber(body.settings.maxTokens)
        if (tokens < 1 || tokens > 2000) {
          errors.push('Max tokens must be between 1 and 2000')
        }
        sanitizedSettings.maxTokens = Math.floor(tokens) // Ensure integer
      }

      // Sanitize and validate responseDelay
      if (body.settings.responseDelay !== undefined) {
        const delay = sanitizeNumber(body.settings.responseDelay)
        if (delay < 0 || delay > 30) {
          errors.push('Response delay must be between 0 and 30 seconds')
        }
        sanitizedSettings.responseDelay = delay
      }

      // Sanitize and validate connectionId
      if (body.settings.connectionId) {
        const sanitizedConnectionId = sanitizeObjectId(body.settings.connectionId)
        if (!sanitizedConnectionId) {
          errors.push('Invalid connection ID format')
        } else {
          sanitizedSettings.connectionId = sanitizedConnectionId
        }
      }

      // Sanitize modelId (text field)
      if (body.settings.modelId) {
        sanitizedSettings.modelId = sanitizeText(body.settings.modelId)
        if (sanitizedSettings.modelId.length > 100) {
          errors.push('Model ID cannot exceed 100 characters')
        }
      }


    }



    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: errors.join(', ')
      })
    }

    // Create agent data with sanitized inputs
    const agentData = {
      name: sanitizedBody.name.trim(),
      description: sanitizedBody.description?.trim() || '',
      prompt: sanitizedBody.prompt.trim(),
      agentType: sanitizedBody.agentType,
      settings: {
        temperature: sanitizedSettings.temperature !== undefined ? sanitizedSettings.temperature : 0.3,
        maxTokens: sanitizedSettings.maxTokens !== undefined ? sanitizedSettings.maxTokens : 500,
        responseDelay: sanitizedSettings.responseDelay !== undefined ? sanitizedSettings.responseDelay : 0,
        connectionId: sanitizedSettings.connectionId || null,
        modelId: sanitizedSettings.modelId || null
      },
      createdBy: user._id,
      isActive: true
    }

    // Create agent
    const agent = new Agent(agentData)
    await agent.save()



    // Note: With Chatwoot authentication, user management is handled by Chatwoot
    // No need to update Agent AI User model since we're using Chatwoot users

    // Note: createdBy is now a simple ID (not ObjectId) so no population needed

    return {
      success: true,
      data: agent
    }
  } catch (error: any) {
    console.error('Create agent error:', error)
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message)
      throw createError({
        statusCode: 400,
        statusMessage: validationErrors.join(', ')
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to create agent'
    })
  }
}) 