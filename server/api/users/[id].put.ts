/**
 * @description Updates a user.
 * @route PUT /api/users/:id
 */
import User from '~/server/models/User'
import { authMiddleware } from '~/server/utils/auth'
import { sanitizeObjectId, sanitizeText } from '~/utils/sanitize'

export default authMiddleware.admin(async (event, checker) => {
  // Get user from checker
  const adminUser = checker.user
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
    const userToUpdate = await User.findById(userId)
    if (!userToUpdate) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    // Prevent admin from deactivating themselves
    if (userId === adminUser._id.toString() && isActive === false) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot deactivate your own account'
      })
    }

    // Prevent admin from changing their own role
    if (userId === adminUser._id.toString() && role && role !== userToUpdate.role) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You cannot change your own role'
      })
    }

    // Update user fields
    if (name !== undefined) userToUpdate.name = sanitizeText(name)
    if (role !== undefined) userToUpdate.role = role
    if (agentAccess !== undefined) {
      if (!Array.isArray(agentAccess)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'agentAccess must be an array.'
        })
      }
      const sanitizedIds = agentAccess.map((id) => sanitizeObjectId(id))
      if (sanitizedIds.some((id) => !id)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'agentAccess contains invalid ObjectIds.'
        })
      }
      userToUpdate.agentAccess = sanitizedIds
    }
    if (isActive !== undefined) userToUpdate.isActive = isActive

    await userToUpdate.save()

    // Populate the response
    await userToUpdate.populate('invitedBy', 'name email')
    await userToUpdate.populate('agentAccess', 'name')

    return {
      success: true,
      data: userToUpdate,
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