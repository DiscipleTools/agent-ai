import { chatwootAuthMiddleware } from '~/server/utils/auth'
import csrfService from '~/server/services/csrfService'

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {
    // Generate CSRF token for the authenticated user
    const csrfToken = csrfService.generateFromRequest(event)

    if (!csrfToken) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to generate CSRF token'
      })
    }

    return {
      success: true,
      data: {
        csrfToken
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate CSRF token'
    })
  }
}) 