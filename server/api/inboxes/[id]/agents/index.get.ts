import Inbox from '~/server/models/Inbox'
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
      .populate('agents.agentId', 'name description settings workflow')
      .lean()

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Format agents array (sorted by priority)
    const agents = ((inbox as any).agents || [])
      .filter((a: any) => a.agentId) // Only include agents that exist
      .map((a: any) => ({
        type: 'processing',
        agentId: a.agentId._id,
        name: a.name,
        description: a.agentId.description,
        priority: a.priority,
        isActive: a.isActive,
        assignedAt: a.assignedAt,
        config: a.config
      }))
      .sort((a: any, b: any) => a.priority - b.priority)

    // All agents (response agent functionality removed)
    const allAgents = [...agents]

    return {
      success: true,
      data: {
        inbox: {
          id: (inbox as any)._id,
          name: (inbox as any).name,
          channelType: (inbox as any).channelType
        },
        responseAgent: null,
        agents,
        allAgents,
        summary: {
          totalAgents: allAgents.length,
          responseAgent: false,
          processingAgents: agents.length,
          activeProcessingAgents: agents.filter((a: any) => a.isActive).length
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