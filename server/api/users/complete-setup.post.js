/**
 * POST /api/users/complete-setup
 * 
 * Completes the user account setup process using an invitation token.
 * This endpoint is used when a new user follows an invitation link
 * to set their name and password for the first time.
 */
import User from '../../models/User.ts'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { connectDB } from '../../utils/db'
import { sanitizeText } from '~/utils/sanitize.js'

export default defineEventHandler(async (event) => {
  try {
    // Ensure database connection
    await connectDB()
    
    const body = await readBody(event)
    const { token, name, password } = body

    // Validate required fields
    if (!token || !name || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Token, name, and password are required'
      })
    }

    // Validate password length
    if (password.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters long'
      })
    }

    // Hash the token to match what's stored in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find user with this invitation token
    const user = await User.findOne({ 
      invitationToken: hashedToken,
      invitationTokenExpires: { $gt: new Date() }
    }).select('+invitationToken +invitationTokenExpires')

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invalid or expired invitation token'
      })
    }

    // Update user with name and password
    user.name = sanitizeText(name)
    user.password = password // Will be hashed by the pre-save hook
    user.isActive = true // Activate the user account
    user.invitationToken = undefined
    user.invitationTokenExpires = undefined
    user.lastLogin = new Date()

    await user.save()

    console.log('Account setup completed for user')

    return {
      success: true,
      message: 'Account setup completed successfully',
      data: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    }

  } catch (error) {
    console.error('Account setup completion error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to complete account setup'
    })
  }
}) 