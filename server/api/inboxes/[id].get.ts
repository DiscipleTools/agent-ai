import { connectDB } from '~/server/utils/db'
import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import { requireChatwootAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    
    const user = await requireChatwootAuth(event)

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
      .populate('responseAgent.agentId', 'name agentType description prompt settings')
      .populate('agents.agentId', 'name agentType description prompt settings')
      .lean()

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    return {
      success: true,
      data: { inbox }
    }

  } catch (error: any) {
    console.error('Error fetching inbox:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch inbox'
    })
  }
})