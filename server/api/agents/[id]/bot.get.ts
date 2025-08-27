/**
 * Agent Bot Status API Endpoint
 * 
 * GET /api/agents/[id]/bot
 * 
 * Returns the current Chatwoot bot integration status for an agent.
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default chatwootAuthMiddleware.agentAccess('read')(async (event, checker, agentId) => {
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

    // Return bot status
    return {
      success: true,
      data: {
        agentId: agent._id,
        agentName: agent.name,
        agentType: agent.agentType,
        hasBot: !!(agent.chatwootBot?.botId),
        bot: agent.chatwootBot || null,
        inboxCount: agent.inboxes?.length || 0,
        accountIds: [...new Set(agent.inboxes?.map(inbox => inbox.accountId) || [])]
      }
    }

  } catch (error: any) {
    console.error('Get agent bot status error:', error)
    
    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get agent bot status'
    })
  }
})
