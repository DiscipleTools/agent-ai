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

    // Find and delete inbox
    const inbox = await Inbox.findOneAndDelete({
      _id: inboxId,
      createdBy: user.id || user._id
    })

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    return {
      success: true,
      message: 'Inbox deleted successfully',
      data: { 
        deletedInboxId: inboxId,
        deletedInbox: {
          name: inbox.name,
          accountId: inbox.accountId,
          inboxId: inbox.inboxId
        }
      }
    }

  } catch (error: any) {
    console.error('Error deleting inbox:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete inbox'
    })
  }
})