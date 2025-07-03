/**
 * POST /api/auth/refresh
 *
 * Refreshes a user's session by accepting a refresh token and returning a new
 * access token and refresh token. The refresh token can be provided in either
 * a cookie or the request body.
 */
import { connectDB } from '~/server/utils/db'
import authService from '~/server/services/authService'
import { sanitizeToken } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get refresh token from cookies or body
    const body = await readBody(event)
    const tokenFromCookie = getCookie(event, 'refresh-token')
    const tokenFromBody = body?.refreshToken ? sanitizeToken(body.refreshToken) : null
    
    const refreshToken = tokenFromCookie || tokenFromBody

    if (!refreshToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token required'
      })
    }

    // Refresh tokens
    const newTokens = await authService.refreshTokens(refreshToken)

    // Set new cookies
    setCookie(event, 'access-token', newTokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    })

    setCookie(event, 'refresh-token', newTokens.refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return {
      success: true,
      data: newTokens
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Token refresh failed'
    })
  }
}) 