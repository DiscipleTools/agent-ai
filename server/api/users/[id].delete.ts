/**
 * @description Permanently deletes a user and cleans up related data associations.
 * @endpoint DELETE /api/users/[id]
 */
import { sanitizeObjectId } from '~/utils/sanitize.js'
import User from '~/server/models/User'
import Agent from '~/server/models/Agent'
import { authMiddleware } from '~/server/utils/auth'

export default authMiddleware.admin(async (event, checker) => {

  const userId = getRouterParam(event, 'id')
  const sanitizedUserId = sanitizeObjectId(userId)

  if (!sanitizedUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid User ID is required'
    })
  }

  try {
    const user = await User.findById(sanitizedUserId)
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    // Prevent admin from deleting themselves
    if (sanitizedUserId === event.context.user._id.toString()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot delete your own account'
      })
    }

    // Handle related data before deletion
    
    // 1. Update agents created by this user to remove the createdBy reference
    // (Set to null or transfer to admin - you can choose the approach)
    await Agent.updateMany(
      { createdBy: sanitizedUserId },
      { $unset: { createdBy: 1 } } // Remove the createdBy field
    )

    // 2. Remove this user from other users' agentAccess arrays
    await User.updateMany(
      { agentAccess: sanitizedUserId },
      { $pull: { agentAccess: sanitizedUserId } }
    )

    // 3. Update users who were invited by this user (set invitedBy to null)
    await User.updateMany(
      { invitedBy: sanitizedUserId },
      { $unset: { invitedBy: 1 } }
    )

    // 4. Hard delete the user from database
    await User.findByIdAndDelete(sanitizedUserId)

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