/**
 * DELETE /api/agents/[id]
 * 
 * Deletes an agent by ID. This endpoint requires authentication and proper authorization.
 * The user must either be an admin or have explicit access to the specified agent.
 * 
 * Security:
 * - AgentId is validated and sanitized in the auth middleware
 * - Authorization is enforced through agentAccess middleware
 * - Uses safe MongoDB operations (findById, findByIdAndDelete)
 * - Proper error handling with appropriate HTTP status codes
 * 
 * @param {string} id - Agent ID (validated as MongoDB ObjectId)
 * @returns {Object} Success response with message
 * @throws {404} Agent not found
 * @throws {403} Access denied (insufficient permissions)
 * @throws {401} Unauthorized (invalid/missing token)
 * @throws {500} Server error
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'

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

export default chatwootAuthMiddleware.agentAccess('delete')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find agent
    const agent = await Agent.findById(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // If the agent has a Chatwoot bot, try to delete it
    if (agent.chatwootBot?.botId && agent.chatwootBot?.accountId) {
      try {
        console.log(`Attempting to delete Chatwoot bot ${agent.chatwootBot.botId} for agent ${agent.name}`)
        
        // Extract user session data for Chatwoot API calls
        const userSessionData = extractUserSessionData(event)
        
        if (userSessionData) {
          // Use user session authentication
          console.log('Deleting bot with user session authentication')
          await chatwootService.deleteAgentBotWithUserSession(
            agent.chatwootBot.accountId,
            agent.chatwootBot.botId,
            userSessionData
          )
        } else {
          // Fallback to custom API key or system configuration
          console.log('Deleting bot with fallback authentication (API key or system config)')
          const customApiKey = agent.settings?.chatwootApiKey || undefined
          await chatwootService.deleteAgentBot(
            agent.chatwootBot.accountId,
            agent.chatwootBot.botId,
            customApiKey
          )
        }
        
        console.log(`Successfully deleted Chatwoot bot ${agent.chatwootBot.botId}`)
      } catch (botError: any) {
        console.error('Failed to delete Chatwoot bot (proceeding with agent deletion):', botError)
        // Don't fail the agent deletion if bot deletion fails
        // The bot can be cleaned up manually later
      }
    }

    // Delete agent
    await Agent.findByIdAndDelete(agentId)

    return {
      success: true,
      message: 'Agent deleted successfully'
    }
  } catch (error: any) {
    console.error('Delete agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to delete agent'
    })
  }
}) 