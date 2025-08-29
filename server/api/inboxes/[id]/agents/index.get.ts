import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import { getUserFromEvent } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const inboxId = getRouterParam(event, 'id')
    if (!inboxId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Inbox ID is required'
      })
    }

    // Find inbox with populated agent references
    const inbox = await Inbox.findOne({
      _id: inboxId,
      createdBy: user.id || user._id
    })
      .populate('responseAgent.agentId', 'name agentType description settings')
      .populate('agents.agentId', 'name agentType description settings')
      .lean()

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Format response data
    const responseAgent = inbox.responseAgent?.agentId ? {
      type: 'response',
      agentId: inbox.responseAgent.agentId._id,
      name: inbox.responseAgent.agentId.name,
      agentType: inbox.responseAgent.agentId.agentType,
      description: inbox.responseAgent.agentId.description,
      assignedAt: inbox.responseAgent.assignedAt,
      config: inbox.responseAgent.config,
      priority: null // Response agents don't have priority
    } : null

    // Format agents array (sorted by priority)
    const agents = inbox.agents
      .filter(a => a.agentId) // Only include agents that exist
      .map(a => ({
        type: 'processing',
        agentId: a.agentId._id,
        name: a.name,
        agentType: a.agentType,
        description: a.agentId.description,
        priority: a.priority,
        isActive: a.isActive,
        assignedAt: a.assignedAt,
        config: a.config
      }))
      .sort((a, b) => a.priority - b.priority)

    // Combine all agents
    const allAgents = [
      ...(responseAgent ? [responseAgent] : []),
      ...agents
    ]

    return {
      success: true,
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name,
          channelType: inbox.channelType
        },
        responseAgent,
        agents,
        allAgents,
        summary: {
          totalAgents: allAgents.length,
          responseAgent: !!responseAgent,
          processingAgents: agents.length,
          activeProcessingAgents: agents.filter(a => a.isActive).length
        }
      }
    }

  } catch (error: any) {
    console.error('Error fetching inbox agents:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch inbox agents'
    })
  }
})