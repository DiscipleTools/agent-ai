/**
 * GET /api/users
 *
 * Fetches all active users from the database.
 * This endpoint is for admin use only.
 */
import User from '~/server/models/User'
import { authMiddleware } from '~/server/utils/auth'
import { connectDB } from '~/server/utils/db'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get all users (both active and inactive)
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .select('-password -refreshTokens')
      .populate('invitedBy', 'name email')
      .populate('agentAccess', 'name')

    return {
      success: true,
      data: users
    }
  } catch (error: any) {
    console.error('Users API Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch users',
      data: { error: error.message }
    })
  }
}) 