/**
 * GET /api/users/validate-invitation
 * Validates a user invitation token to ensure it is valid and not expired.
 * Returns basic user information if the token is valid.
 */
import User from '../../models/User.ts'
import { connectDB } from '../../utils/db'
import crypto from 'crypto'
import { sanitizeToken, sanitizeErrorMessage } from '../../../utils/sanitize.js'

export default defineEventHandler(async (event) => {
  try {
    // Ensure database connection
    await connectDB()
    
    const query = getQuery(event)
    const token = sanitizeToken(query.token)

    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invitation token is required'
      })
    }

    // Hash the token to match what's stored in the database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find user with this invitation token
    const user = await User.findOne({ 
      invitationToken: hashedToken,
      invitationTokenExpires: { $gt: new Date() },
      isActive: false // User hasn't completed setup yet
    }).select('+invitationToken +invitationTokenExpires').populate('invitedBy', 'name email')

    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invalid or expired invitation token'
      })
    }

    // Return invitation details (without sensitive data)
    return {
      success: true,
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        invitedBy: user.invitedBy,
        createdAt: user.createdAt
      }
    }

  } catch (error) {
    console.error('Invitation validation error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: sanitizeErrorMessage(error) || 'Failed to validate invitation'
    })
  }
}) 