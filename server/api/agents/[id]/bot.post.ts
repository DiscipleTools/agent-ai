/**
 * Agent Bot Management API Endpoint
 * 
 * POST /api/agents/[id]/bot
 * 
 * Creates or recreates a Chatwoot bot for an existing agent and configures
 * the associated inboxes. This is useful for agents that were created before
 * bot integration was enabled or when bot integration needs to be reset.
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'
import { sanitizeText } from '~/utils/sanitize'

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

interface BotActionRequest {
  action: 'create' | 'recreate' | 'configure'
  accountId?: number
}

interface BotResponse {
  id: number
  name: string
}

export default chatwootAuthMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event) as BotActionRequest

    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body'
      })
    }

    // Validate action
    const validActions = ['create', 'recreate', 'configure']
    if (!body.action || !validActions.includes(body.action)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid action. Must be one of: ${validActions.join(', ')}`
      })
    }

    // Find agent
    const agent = await Agent.findById(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Validate that this is a response agent
    if (agent.agentType !== 'response') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bot integration is only available for response agents'
      })
    }

    // Validate that agent has inboxes
    if (!agent.inboxes || agent.inboxes.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent must have at least one assigned inbox for bot integration'
      })
    }

    let accountId = body.accountId
    
    // If no accountId provided, use the first inbox's account
    if (!accountId) {
      accountId = agent.inboxes[0].accountId
    }

    // Validate that the accountId exists in agent's inboxes
    const validAccountIds = [...new Set(agent.inboxes.map((inbox: any) => inbox.accountId))]
    if (!validAccountIds.includes(accountId)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid accountId. Agent is only assigned to accounts: ${validAccountIds.join(', ')}`
      })
    }

    // Get the full webhook URL for the agent
    const webhookUrl = `${process.env.FRONTEND_URL}${agent.webhookUrl}`

    // Extract user session data for Chatwoot API calls
    const userSessionData = extractUserSessionData(event)

    let botResponse: BotResponse | null = null
    let shouldConfigureInboxes = true

    // Handle different actions
    if (body.action === 'create') {
      // Check if bot already exists
      if (agent.chatwootBot?.botId && agent.chatwootBot?.isConfigured) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bot already exists for this agent. Use "recreate" action to replace it.'
        })
      }

      // Create new bot
      const authHeaders = userSessionData || agent.settings?.chatwootApiKey
      botResponse = await chatwootService.createAgentBot(
        accountId!,
        agent.name,
        agent.description || `AI Agent: ${agent.name}`,
        webhookUrl,
        authHeaders
      )

    } else if (body.action === 'recreate') {
      // Delete existing bot if it exists
      if (agent.chatwootBot?.botId && agent.chatwootBot?.accountId) {
        try {
          const authHeaders = userSessionData || agent.settings?.chatwootApiKey
          await chatwootService.deleteAgentBot(
            agent.chatwootBot.accountId,
            agent.chatwootBot.botId,
            authHeaders
          )
          console.log(`Deleted existing bot ${agent.chatwootBot.botId}`)
        } catch (deleteError: any) {
          console.warn('Failed to delete existing bot (proceeding with creation):', deleteError.message)
        }
      }

      // Create new bot
      const authHeaders = userSessionData || agent.settings?.chatwootApiKey
      botResponse = await chatwootService.createAgentBot(
        accountId!,
        agent.name,
        agent.description || `AI Agent: ${agent.name}`,
        webhookUrl,
        authHeaders
      )

    } else if (body.action === 'configure') {
      // Just configure existing bot with inboxes
      if (!agent.chatwootBot?.botId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'No bot exists for this agent. Use "create" action first.'
        })
      }

      botResponse = {
        id: agent.chatwootBot.botId,
        name: agent.chatwootBot.botName
      }
      
      // We'll configure the inboxes below
    }

    // Configure inboxes with the bot (only for the specified account)
    const inboxesToConfigure = agent.inboxes.filter((inbox: any) => inbox.accountId === accountId)
    
    if (shouldConfigureInboxes && inboxesToConfigure.length > 0 && botResponse) {
      const configurationPromises = inboxesToConfigure.map(async (inbox: any) => {
        try {
          const authHeaders = userSessionData || agent.settings?.chatwootApiKey
          await chatwootService.configureInboxBot(
            inbox.accountId,
            inbox.inboxId,
            botResponse!.id,
            authHeaders
          )
          console.log(`Inbox ${inbox.inboxId} configured with bot ${botResponse!.id}`)
          return { success: true, inboxId: inbox.inboxId }
        } catch (error: any) {
          console.error(`Failed to configure inbox ${inbox.inboxId} with bot:`, error)
          return { success: false, inboxId: inbox.inboxId, error: error.message }
        }
      })
      
      const configurationResults = await Promise.all(configurationPromises)
      const successfulConfigurations = configurationResults.filter(result => result.success)
      
      // Update agent with bot information
      agent.chatwootBot = {
        accountId: accountId!,
        botId: botResponse.id,
        botName: botResponse.name,
        createdAt: new Date(),
        isConfigured: successfulConfigurations.length > 0
      }
      
      await agent.save()
      
      console.log(`Bot operation "${body.action}" completed: ${successfulConfigurations.length}/${inboxesToConfigure.length} inboxes configured`)
      
      return {
        success: true,
        data: {
          action: body.action,
          bot: agent.chatwootBot,
          configurationResults: configurationResults
        }
      }
    }

    // If no inboxes to configure, just update the bot info
    if (body.action !== 'configure' && botResponse) {
      agent.chatwootBot = {
        accountId: accountId!,
        botId: botResponse.id,
        botName: botResponse.name,
        createdAt: new Date(),
        isConfigured: false
      }
      
      await agent.save()
    }

    return {
      success: true,
      data: {
        action: body.action,
        bot: agent.chatwootBot,
        message: `Bot ${body.action} completed successfully`
      }
    }

  } catch (error: any) {
    console.error('Agent bot management error:', error)
    
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to manage agent bot'
    })
  }
})
