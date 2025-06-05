import User from '~/server/models/User'
import { requireAuth } from '~/server/utils/auth'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // Require authentication 
  const authUser = await requireAuth(event)

  const body = await readBody(event)
  const { name, email, currentPassword, newPassword } = body

  // Validate that user exists
  const user = await User.findById(authUser._id).select('+password')
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // If changing password, verify current password first
  if (newPassword) {
    if (!currentPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Current password is required to change password'
      })
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Current password is incorrect'
      })
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'New password must be at least 8 characters long'
      })
    }

    user.password = newPassword // Will be hashed by pre-save hook
  }

  // Update name if provided
  if (name !== undefined) {
    if (!name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name cannot be empty'
      })
    }
    user.name = name.trim()
  }

  // Update email if provided
  if (email !== undefined) {
    if (!email.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email cannot be empty'
      })
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    if (!emailRegex.test(email)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please enter a valid email address'
      })
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: user._id }
    })

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email address is already in use'
      })
    }

    user.email = email.toLowerCase()
  }

  try {
    await user.save()

    // Return user data without sensitive fields
    const updatedUser = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }

    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    }
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error (email)
      throw createError({
        statusCode: 409,
        statusMessage: 'Email address is already in use'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update profile'
    })
  }
}) 