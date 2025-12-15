import { connectDB } from '~/server/utils/db'
import Inbox from '~/server/models/Inbox'
import { requireChatwootAuth } from '~/server/utils/auth'
import chatwootService from '~/server/services/chatwootService'

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

    // Find inbox to get account ID and API key
    const inbox = await Inbox.findOne({
      _id: inboxId,
      createdBy: user.id || user._id
    })
      .lean() as any

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Fetch labels from Chatwoot
    const labelsResponse = await chatwootService.getLabels(
      inbox.accountId,
      inbox.apiKey
    )

    // Extract labels array from response
    const labels = labelsResponse?.payload || []

    return {
      success: true,
      data: { labels }
    }

  } catch (error: any) {
    console.error('Error fetching labels:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch labels'
    })
  }
})
