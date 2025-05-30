import User from '~/server/models/User'
import crypto from 'crypto'
import emailService from '~/server/services/emailService'
import authService from '~/server/services/authService'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body

  // Validate required fields
  if (!token || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token and password are required'
    })
  }

  // Validate password strength
  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters long'
    })
  }

  try {
    // Hash the token to match what's stored in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find user with valid invitation token
    const user = await User.findOne({
      invitationToken: hashedToken,
      invitationTokenExpires: { $gt: Date.now() }
    }).select('+invitationToken +invitationTokenExpires')

    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or expired invitation token'
      })
    }

    // Update user password and clear invitation token
    user.password = password // Will be hashed by pre-save hook
    user.invitationToken = undefined
    user.invitationTokenExpires = undefined
    user.lastLogin = new Date()

    await user.save()

    // Generate JWT tokens using auth service
    const tokens = authService.generateTokens(String(user._id)) as { accessToken: string; refreshToken: string }

    // Store refresh token
    user.addRefreshToken(tokens.refreshToken)
    await user.save()

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.name)
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError)
      // Don't fail the setup if email fails
    }

    return {
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        tokens
      },
      message: 'Account setup completed successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to complete account setup'
    })
  }
}) 