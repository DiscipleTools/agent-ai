import { connectDB } from '~/server/utils/db'
import authService from '~/server/services/authService'
import { sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { email, password } = body

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email)
    const sanitizedPassword = password // Don't sanitize passwords

    // Validate input
    if (!sanitizedEmail || !sanitizedPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid email and password are required'
      })
    }

    // Authenticate user
    const result = await authService.login(sanitizedEmail, sanitizedPassword)

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
    const sanitizedMessage = sanitizeErrorMessage(error)
    throw createError({
      statusCode: error.statusCode || 401,
      statusMessage: sanitizedMessage
    })
  }
}) 