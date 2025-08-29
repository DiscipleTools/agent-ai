import { connectDB } from '~/server/utils/db'
import { requireChatwootAuth } from '~/server/utils/auth'
import inboxService from '~/server/services/inboxService'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    
    // Authenticate with Chatwoot
    const user = await requireChatwootAuth(event)

    // Manually sync user's inboxes from Chatwoot
    const result = await inboxService.syncUserInboxes(user)

    return {
      success: true,
      message: 'Manual sync with Chatwoot completed',
      data: result
    }

  } catch (error: any) {
    console.error('Error syncing with Chatwoot:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to sync with Chatwoot'
    })
  }
})