import { connectDB } from '~/server/utils/db'
import authService from '~/server/services/authService'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required'
      })
    }

    // Authenticate user
    const result = await authService.login(email, password)

    // Set cookies for tokens
    setCookie(event, 'access-token', result.tokens.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    })

    setCookie(event, 'refresh-token', result.tokens.refreshToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return {
      success: true,
      data: result
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: error.message || 'Authentication failed'
    })
  }
}) 