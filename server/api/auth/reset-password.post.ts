/**
 * POST /api/auth/reset-password
 * 
 * Handles password reset using a reset token and new password.
 */
import { connectDB } from '~/server/utils/db'
import User from '~/server/models/User'
import crypto from 'crypto'
import { sanitizeText, sanitizePassword } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    const body = await readBody(event)
    const { token, password } = body
    
    // Sanitize inputs
    const sanitizedToken = sanitizeText(token)
    const sanitizedPassword = sanitizePassword(password)
    
    // Validate required fields
    if (!sanitizedToken || !sanitizedPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Token and password are required'
      })
    }

    // Validate password length
    if (sanitizedPassword.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters long'
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
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or expired reset token'
      })
    }

    // Update user password and clear reset token
    user.password = sanitizedPassword // Will be hashed by pre-save hook
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.lastLogin = new Date()

    await user.save()

    return {
      success: true,
      message: 'Password reset successfully'
    }

  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reset password'
    })
  }
}) 