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
  chatwootApiKey?: string
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
      agentType: sanitizeText(body.agentType) || 'response',
      inboxes: body.inboxes || []
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
    const validAgentTypes = ['response']
    if (!validAgentTypes.includes(sanitizedBody.agentType)) {
      errors.push(`Invalid agent type. Must be: ${validAgentTypes.join(', ')}`)
    }

    // Validate and sanitize inbox assignments
    const sanitizedInboxes = []
    if (sanitizedBody.inboxes && Array.isArray(sanitizedBody.inboxes)) {
      for (let i = 0; i < sanitizedBody.inboxes.length; i++) {
        const inbox = sanitizedBody.inboxes[i]
        
        if (!inbox || typeof inbox !== 'object') {
          errors.push(`Invalid inbox assignment at index ${i}`)
          continue
        }

        const sanitizedInbox = {
          accountId: sanitizeNumber(inbox.accountId),
          inboxId: sanitizeNumber(inbox.inboxId),
          accountName: sanitizeText(inbox.accountName) || '',
          inboxName: sanitizeText(inbox.inboxName) || '',
          channelType: sanitizeText(inbox.channelType) || ''
        }

        // Validate required fields
        if (!sanitizedInbox.accountId || !sanitizedInbox.inboxId) {
          errors.push(`Inbox assignment at index ${i} missing required accountId or inboxId`)
          continue
        }

        sanitizedInboxes.push(sanitizedInbox)
      }
    }

    // Validate settings with additional sanitization
    const sanitizedSettings: {
      temperature?: number
      maxTokens?: number
      responseDelay?: number
      connectionId?: string | null
      modelId?: string | null
      chatwootApiKey?: string | null
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

      // Sanitize chatwootApiKey if present
      if (body.settings.chatwootApiKey) {
        sanitizedSettings.chatwootApiKey = sanitizeText(body.settings.chatwootApiKey)
        if (sanitizedSettings.chatwootApiKey.length > 200) {
          errors.push('Chatwoot API key cannot exceed 200 characters')
        }
      }
    }

    // Validate inbox permissions - only allow inboxes where user is administrator
    if (sanitizedInboxes.length > 0) {
      const inboxValidation = await validateInboxPermissions(user, sanitizedInboxes)
      if (!inboxValidation.isValid) {
        errors.push(`Access denied to inboxes: ${inboxValidation.invalidInboxes.join('; ')}`)
      }
    }

    // Validate response agent inbox constraints - only one response agent per inbox
    if (sanitizedBody.agentType === 'response' && sanitizedInboxes.length > 0) {
      const responseAgentValidation = await (Agent as any).validateResponseAgentInboxes(sanitizedInboxes)
      if (!responseAgentValidation.isValid) {
        const conflictMessages = responseAgentValidation.conflicts.map((conflict: any) => 
          `Inbox "${conflict.inboxName}" already has response agent "${conflict.existingAgentName}"`
        )
        errors.push(...conflictMessages)
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
        modelId: sanitizedSettings.modelId || null,
        chatwootApiKey: sanitizedSettings.chatwootApiKey || null
      },
      inboxes: sanitizedInboxes,
      createdBy: user._id,
      isActive: true
    }

    // Create agent
    const agent = new Agent(agentData)
    await agent.save()

    // If this is a response agent with inboxes, create a Chatwoot bot and configure inboxes
    let chatwootBotData = null
    if (sanitizedBody.agentType === 'response' && sanitizedInboxes.length > 0) {
      try {
        // Get the first inbox's account ID for bot creation
        const firstInbox = sanitizedInboxes[0]
        const accountId = firstInbox.accountId
        
        // Get the full webhook URL for the agent
        const webhookUrl = `${process.env.FRONTEND_URL}${agent.webhookUrl}`
        
        // Extract user session data for Chatwoot API calls
        const userSessionData = extractUserSessionData(event)
        
        const authHeaders = userSessionData || sanitizedSettings.chatwootApiKey
        console.log('Creating bot with authentication type:', userSessionData ? 'user session' : 'API key')
        const botResponse = await chatwootService.createAgentBot(
          accountId,
          agent.name,
          agent.description || `AI Agent: ${agent.name}`,
          webhookUrl,
          authHeaders
        )
        
        console.log('Chatwoot bot created:', botResponse)
        
        // Store bot information in agent
        chatwootBotData = {
          accountId: accountId,
          botId: botResponse.id,
          botName: botResponse.name,
          createdAt: new Date(),
          isConfigured: false
        }
        
        // Configure each inbox with the new bot
        const configurationPromises = sanitizedInboxes.map(async (inbox) => {
          try {
            const authHeaders = userSessionData || sanitizedSettings.chatwootApiKey
            await chatwootService.configureInboxBot(
              inbox.accountId,
              inbox.inboxId,
              botResponse.id,
              authHeaders
            )
            console.log(`Inbox ${inbox.inboxId} configured with bot ${botResponse.id}`)
            return { success: true, inboxId: inbox.inboxId }
          } catch (error: any) {
            console.error(`Failed to configure inbox ${inbox.inboxId} with bot:`, error)
            return { success: false, inboxId: inbox.inboxId, error: error.message }
          }
        })
        
        const configurationResults = await Promise.all(configurationPromises)
        const successfulConfigurations = configurationResults.filter(result => result.success)
        
        if (successfulConfigurations.length > 0) {
          chatwootBotData.isConfigured = true
        }
        
        // Update agent with bot information
        agent.chatwootBot = chatwootBotData
        await agent.save()
        
        console.log(`Bot created and ${successfulConfigurations.length}/${sanitizedInboxes.length} inboxes configured successfully`)
        
      } catch (botError) {
        console.error('Failed to create Chatwoot bot:', botError)
        // Don't fail the agent creation, but log the error
        // The agent can still be used without the Chatwoot bot integration
        console.warn('Agent created successfully but Chatwoot bot creation failed. Bot integration can be set up manually later.')
      }
    }

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