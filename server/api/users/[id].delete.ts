import User from '~/server/models/User'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication and admin role
  await requireAuth(event)
  await requireAdmin(event)

  const userId = getRouterParam(event, 'id')

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    })
  }

  try {
    const user = await User.findById(userId)
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    // Prevent admin from deleting themselves
    if (userId === event.context.user._id.toString()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot delete your own account'
      })
    }

    // Soft delete by setting isActive to false
    user.isActive = false
    await user.save()

    return {
      success: true,
      message: 'User deleted successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete user'
    })
  }
}) 