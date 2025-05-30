import { connectDB } from '~/server/utils/db'
import authService from '~/server/services/authService'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get refresh token from cookies or body
    const body = await readBody(event)
    const refreshToken = getCookie(event, 'refresh-token') || body?.refreshToken

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
      maxAge: 60 * 60 // 1 hour
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