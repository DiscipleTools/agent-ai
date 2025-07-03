import User from '~/server/models/User'
import { authMiddleware } from '~/server/utils/auth'

export default authMiddleware.admin(async (event, checker) => {
  // Get user from checker
  const user = checker.user
  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { name, role, agentAccess, isActive } = body

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    })
  }

  // Validate role if provided
  if (role && !['admin', 'user'].includes(role)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role must be either admin or user'
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

    // Prevent admin from deactivating themselves
    if (userId === user._id.toString() && isActive === false) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot deactivate your own account'
      })
    }

    // Prevent admin from changing their own role
    if (userId === user._id.toString() && role && role !== user.role) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot change your own role'
      })
    }

    // Update user fields
    if (name !== undefined) user.name = name.trim()
    if (role !== undefined) user.role = role
    if (agentAccess !== undefined) user.agentAccess = agentAccess
    if (isActive !== undefined) user.isActive = isActive

    await user.save()

    // Populate the response
    await user.populate('invitedBy', 'name email')
    await user.populate('agentAccess', 'name')

    return {
      success: true,
      data: user,
      message: 'User updated successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user'
    })
  }
}) 