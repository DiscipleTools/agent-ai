/**
 * GET /api/auth/validate-reset-token
 * 
 * Validates a password reset token to check if it's valid and not expired.
 */
import { connectDB } from '~/server/utils/db'
import User from '~/server/models/User'
import crypto from 'crypto'
import { sanitizeText } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    const query = getQuery(event)
    const { token } = query

    // Sanitize token input
    const sanitizedToken = sanitizeText(token)

    // Validate token parameter
    if (!sanitizedToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Token is required'
      })
    }

    // Hash the token to match what's stored in the database
    const hashedToken = crypto.createHash('sha256').update(sanitizedToken).digest('hex')

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires')

    if (!user) {
      return {
        success: false,
        message: 'Invalid or expired reset token'
      }
    }

    return {
      success: true,
      message: 'Token is valid',
      data: {
        email: user.email,
        name: user.name
      }
    }

  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to validate reset token'
    })
  }
}) 