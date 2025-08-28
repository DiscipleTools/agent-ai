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

    // Check if response agent is assigned
    if (!inbox.responseAgent?.agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No response agent is currently assigned'
      })
    }

    // Store info for response before removing
    const removedAgent = {
      agentId: inbox.responseAgent.agentId,
      assignedAt: inbox.responseAgent.assignedAt
    }

    // Remove response agent
    inbox.removeResponseAgent()
    await inbox.save()

    return {
      success: true,
      message: 'Response agent removed successfully',
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        removedAgent
      }
    }

  } catch (error: any) {
    console.error('Error removing response agent:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove response agent'
    })
  }
})