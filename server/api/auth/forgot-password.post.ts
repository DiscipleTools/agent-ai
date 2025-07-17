/**
 * POST /api/auth/forgot-password
 * 
 * Handles forgot password requests by generating a reset token
 * and sending a password reset email to the user.
 */
import { connectDB } from '~/server/utils/db'
import User from '~/server/models/User'
import emailService from '~/server/services/emailService'
import { sanitizeEmail } from '~/utils/sanitize'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    const body = await readBody(event)
    const { email } = body

    // Validate email
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email is required'
      })
    }

    const sanitizedEmail = sanitizeEmail(email)

    // Find user by email
    const user = await User.findOne({ 
      email: sanitizedEmail,
      isActive: true 
    })

    // Always return success to prevent email enumeration
    // Don't reveal whether the email exists or not
    if (!user) {
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }

    // Generate password reset token
    const resetToken = user.createPasswordResetToken()
    await user.save()

    // Send password reset email
    try {
      const emailSent = await emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      )

      if (!emailSent) {
        console.warn(`Password reset email could not be sent to ${user.email}`)
      }
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      // Don't fail the request if email fails
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    }

  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process password reset request'
    })
  }
}) 