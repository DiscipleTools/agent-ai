import User from '~/server/models/User'
import { requireAuth, requireAdmin } from '~/server/utils/auth'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  // Require authentication and admin role
  await requireAuth(event)
  await requireAdmin(event)

  const body = await readBody(event)
  const { email, name, role = 'user', agentAccess = [] } = body

  // Validate required fields
  if (!email || !name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and name are required'
    })
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please enter a valid email'
    })
  }

  // Validate role
  if (!['admin', 'user'].includes(role)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role must be either admin or user'
    })
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists'
      })
    }

    // Generate a temporary password (user will need to reset it)
    const tempPassword = Math.random().toString(36).slice(-12)
    
    // Create new user
    const newUser = new User({
      email: email.toLowerCase(),
      name: name.trim(),
      password: tempPassword, // Will be hashed by the pre-save hook
      role,
      agentAccess,
      invitedBy: event.context.user._id,
      isActive: true
    })

    await newUser.save()

    // Populate the response
    await newUser.populate('invitedBy', 'name email')
    await newUser.populate('agentAccess', 'name')

    // TODO: Send invitation email with temporary password
    // This would typically send an email with a password reset link

    return {
      success: true,
      data: newUser,
      message: 'User invited successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to invite user'
    })
  }
}) 