import User from '~/server/models/User'
import { requireAuth, requireAdmin } from '~/server/utils/auth'
import { connectDB } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()
    
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const users = await User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('-password -refreshTokens')

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