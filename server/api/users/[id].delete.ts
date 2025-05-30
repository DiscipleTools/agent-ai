import User from '~/server/models/User'
import Agent from '~/server/models/Agent'
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

    // Handle related data before deletion
    
    // 1. Update agents created by this user to remove the createdBy reference
    // (Set to null or transfer to admin - you can choose the approach)
    await Agent.updateMany(
      { createdBy: userId },
      { $unset: { createdBy: 1 } } // Remove the createdBy field
    )

    // 2. Remove this user from other users' agentAccess arrays
    await User.updateMany(
      { agentAccess: userId },
      { $pull: { agentAccess: userId } }
    )

    // 3. Update users who were invited by this user (set invitedBy to null)
    await User.updateMany(
      { invitedBy: userId },
      { $unset: { invitedBy: 1 } }
    )

    // 4. Hard delete the user from database
    await User.findByIdAndDelete(userId)

    return {
      success: true,
      message: 'User permanently deleted successfully'
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