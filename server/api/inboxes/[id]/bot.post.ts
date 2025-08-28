/**
 * Inbox Bot Management API Endpoint
 * 
 * POST /api/inboxes/[id]/bot
 * 
 * Creates or recreates a Chatwoot bot for an inbox. This follows the inbox-centric
 * architecture where the inbox owns the bot integration that all assigned agents use.
 */

import { connectDB } from '~/server/utils/db'
import { requireChatwootAuth } from '~/server/utils/auth'
import Inbox from '~/server/models/Inbox'
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
  action?: 'create' | 'recreate'
  botName?: string
}

interface BotResponse {
  id: number
  name: string
}

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    const user = await requireChatwootAuth(event)
    
    // Connect to database
    await connectDB()

    // Get inbox ID from route params
    const inboxId = getRouterParam(event, 'id')
    if (!inboxId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Inbox ID is required'
      })
    }

    // Get request body
    const body = await readBody(event) as BotActionRequest

    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body'
      })
    }

    // Find inbox - ensure user owns it
    const inbox = await Inbox.findOne({
      _id: inboxId,
      createdBy: user.id || user._id
    })

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Determine bot name
    const botName = body.botName || `${inbox.name} Bot`
    
    // Determine action
    const action = body.action || (inbox.chatwoot?.botId ? 'recreate' : 'create')

    // Validate action
    const validActions = ['create', 'recreate']
    if (!validActions.includes(action)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid action. Must be one of: ${validActions.join(', ')}`
      })
    }

    // Get the webhook URL for the inbox
    const webhookUrl = `${process.env.FRONTEND_URL}${inbox.webhookUrl}`

    // Extract user session data for Chatwoot API calls
    const userSessionData = extractUserSessionData(event)

    let botResponse: BotResponse | null = null

    // Handle different actions
    if (action === 'create') {
      // Check if bot already exists
      if (inbox.chatwoot?.botId && inbox.chatwoot?.isConfigured) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bot already exists for this inbox. Use "recreate" action to replace it.'
        })
      }

      // Create new bot
      const authHeaders = userSessionData || inbox.chatwoot?.apiKey
      botResponse = await chatwootService.createAgentBot(
        inbox.accountId,
        botName,
        `AI Bot for ${inbox.name}`,
        webhookUrl,
        authHeaders
      )

    } else if (action === 'recreate') {
      // Delete existing bot if it exists
      if (inbox.chatwoot?.botId) {
        try {
          const authHeaders = userSessionData || inbox.chatwoot?.apiKey
          await chatwootService.deleteAgentBot(
            inbox.accountId,
            inbox.chatwoot.botId,
            authHeaders
          )
          console.log(`Deleted existing bot ${inbox.chatwoot.botId} for inbox ${inbox._id}`)
        } catch (deleteError: any) {
          console.warn('Failed to delete existing bot (proceeding with creation):', deleteError.message)
        }
      }

      // Create new bot
      const authHeaders = userSessionData || inbox.chatwoot?.apiKey
      botResponse = await chatwootService.createAgentBot(
        inbox.accountId,
        botName,
        `AI Bot for ${inbox.name}`,
        webhookUrl,
        authHeaders
      )
    }

    // Configure the inbox with the bot
    if (botResponse) {
      try {
        const authHeaders = userSessionData || inbox.chatwoot?.apiKey
        await chatwootService.configureInboxBot(
          inbox.accountId,
          inbox.inboxId,
          botResponse.id,
          authHeaders
        )
        console.log(`Inbox ${inbox.inboxId} configured with bot ${botResponse.id}`)
        
        // Update inbox with bot information
        inbox.chatwoot = {
          ...inbox.chatwoot,
          botId: botResponse.id,
          botName: botResponse.name,
          isConfigured: true,
          lastSync: new Date()
        }
        
        await inbox.save()
        
        return {
          success: true,
          data: {
            action: action,
            bot: {
              botId: botResponse.id,
              botName: botResponse.name,
              isConfigured: true
            },
            inbox: {
              id: inbox._id,
              name: inbox.name,
              accountId: inbox.accountId,
              inboxId: inbox.inboxId
            }
          }
        }
      } catch (configError: any) {
        console.error(`Failed to configure inbox ${inbox.inboxId} with bot:`, configError)
        
        // Still save the bot info even if configuration failed
        inbox.chatwoot = {
          ...inbox.chatwoot,
          botId: botResponse.id,
          botName: botResponse.name,
          isConfigured: false,
          lastSync: new Date()
        }
        
        await inbox.save()
        
        throw createError({
          statusCode: 500,
          statusMessage: `Bot created but failed to configure with inbox: ${configError.message}`
        })
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create bot'
    })

  } catch (error: any) {
    console.error('Inbox bot management error:', error)
    
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to manage inbox bot'
    })
  }
})