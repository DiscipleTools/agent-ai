// GET /api/auth/me
// This endpoint retrieves the authenticated user's profile information.

import { connectDB } from '~/server/utils/db'
import authService from '~/server/services/authService'
import { sanitizeUserForFrontend } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get access token from cookies or Authorization header
    const accessToken = getCookie(event, 'access-token') || 
                       getHeader(event, 'authorization')?.replace('Bearer ', '')

    if (!accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Access token required'
      })
    }

    // Verify token and get user
    const decoded = await authService.verifyAccessToken(accessToken)
    const user = await authService.getUserById(decoded.userId)

    return {
      success: true,
      data: sanitizeUserForFrontend(user)
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Authentication failed'
    })
  }
}) 