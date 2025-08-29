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
    const agentId = getRouterParam(event, 'agentId')
    
    if (!inboxId || !agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Both inbox ID and agent ID are required'
      })
    }

    // Find and validate inbox
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

    // Find the agent in the agents array
    const agentAssignment = inbox.agents.find(a => a.agentId.toString() === agentId)
    if (!agentAssignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent is not assigned to this inbox'
      })
    }

    // Store info for response before removing
    const removedAgent = {
      agentId: agentAssignment.agentId,
      name: agentAssignment.name,
      agentType: agentAssignment.agentType,
      priority: agentAssignment.priority,
      assignedAt: agentAssignment.assignedAt
    }

    // Remove agent from agents array
    inbox.removeAgent(agentId)
    await inbox.save()

    return {
      success: true,
      message: 'Agent removed from processing pipeline successfully',
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        removedAgent,
        summary: {
          remainingAgents: inbox.agents.length,
          activeAgents: inbox.agents.filter(a => a.isActive).length
        }
      }
    }

  } catch (error: any) {
    console.error('Error removing agent from inbox:', error)
    
    if (error.statusCode) {
      throw error
    }

    // Handle mongoose errors from removeAgent method
    if (error.message?.includes('not assigned')) {
      throw createError({
        statusCode: 404,
        statusMessage: error.message
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove agent from inbox'
    })
  }
})