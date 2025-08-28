import { requireChatwootAuth } from '~/server/utils/auth'
import inboxService from '~/server/services/inboxService'

export default defineEventHandler(async (event) => {
  try {
    // Authenticate with Chatwoot
    const user = await requireChatwootAuth(event)

    const query = getQuery(event)
    const {
      accountId,
      channelType,
      isActive,
      page = '1',
      limit = '10'
    } = query

    // Get user's accessible inboxes (auto-syncs from Chatwoot)
    let inboxes = await inboxService.getInboxesForUser(user)

    // Apply client-side filters
    if (accountId) {
      const filterAccountId = parseInt(accountId as string)
      inboxes = inboxes.filter(inbox => inbox.accountId === filterAccountId)
    }
    
    if (channelType) {
      inboxes = inboxes.filter(inbox => inbox.channelType === channelType)
    }
    
    if (isActive !== undefined && isActive !== '') {
      const filterActive = isActive === 'true'
      inboxes = inboxes.filter(inbox => inbox.isActive === filterActive)
    }

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)))
    const skip = (pageNum - 1) * limitNum
    const total = inboxes.length
    const pages = Math.ceil(total / limitNum)

    // Paginate results
    const paginatedInboxes = inboxes.slice(skip, skip + limitNum)

    return {
      success: true,
      data: {
        inboxes: paginatedInboxes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages
        }
      }
    }

  } catch (error: any) {
    console.error('Error fetching inboxes:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch inboxes'
    })
  }
})