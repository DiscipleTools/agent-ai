// PUT /api/auth/profile
// Updates the profile of the currently authenticated user.

import User from '~/server/models/User'
import { authMiddleware } from '~/server/utils/auth'
import { connectDB } from '~/server/utils/db'
import { sanitizeEmail, sanitizeText, sanitizeErrorMessage, sanitizePassword } from '~/utils/sanitize.js'

export default authMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get authenticated user
    const authUser = checker.user

    // Get request body
    const body = await readBody(event)
    let { name, email, currentPassword, newPassword, confirmPassword } = body

    // Sanitize inputs
    const sanitizedName = name !== undefined ? sanitizeText(name) : undefined
    const sanitizedEmail = email !== undefined ? sanitizeEmail(email) : undefined
    currentPassword = currentPassword !== undefined ? sanitizePassword(currentPassword) : undefined
    newPassword = newPassword !== undefined ? sanitizePassword(newPassword) : undefined
    confirmPassword = confirmPassword !== undefined ? sanitizePassword(confirmPassword) : undefined

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

      // Prevent overly long passwords
      if (currentPassword.length > 128) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Password cannot be longer than 128 characters'
        })
      }

      // Server-side password confirmation validation
      if (!confirmPassword) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Password confirmation is required'
        })
      }

      if (newPassword !== confirmPassword) {
        throw createError({
          statusCode: 400,
          statusMessage: 'New password and confirmation do not match'
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

      // Validate maximum password length
      if (newPassword.length > 128) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Password cannot be longer than 128 characters'
        })
      }

      user.password = newPassword // Will be hashed by pre-save hook
    }

    // Update name if provided
    if (sanitizedName !== undefined) {
      if (!sanitizedName.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Name cannot be empty'
        })
      }
      
      if (sanitizedName.length > 100) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Name cannot be longer than 100 characters'
        })
      }
      
      user.name = sanitizedName.trim()
    }

    // Update email if provided
    if (sanitizedEmail !== undefined) {
      const trimmedEmail = sanitizedEmail.trim()
      
      if (!trimmedEmail) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Email cannot be empty'
        })
      }

      if (trimmedEmail.length > 254) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Email cannot be longer than 254 characters'
        })
      }

      // Validate email format (more lenient regex)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Please enter a valid email address'
        })
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: trimmedEmail.toLowerCase(),
        _id: { $ne: user._id }
      })

      if (existingUser) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Email address is already in use'
        })
      }

      user.email = trimmedEmail.toLowerCase()
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
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    const sanitizedMessage = sanitizeErrorMessage(error)
    throw createError({
      statusCode: 500,
      statusMessage: sanitizedMessage
    })
  }
}) 