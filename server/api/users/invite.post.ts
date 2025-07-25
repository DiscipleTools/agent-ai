/**
 * @description Invite a new user to the platform.
 * @endpoint POST /api/users/invite
 */
import User from '~/server/models/User'
import { authMiddleware } from '~/server/utils/auth'
import emailService from '~/server/services/emailService'
import { sanitizeText, sanitizeEmail, sanitizeObjectId } from '~/utils/sanitize'

export default authMiddleware.admin(async (event, checker) => {
  // Get user from checker
  const user = checker.user
  const body = await readBody(event)
  const { email, name, role = 'user', agentAccess = [] } = body

  // Validate required fields
  if (!email || !name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and name are required'
    })
  }

  // Sanitize and validate inputs
  const sanitizedEmail = sanitizeEmail(email)
  const sanitizedName = sanitizeText(name)

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(sanitizedEmail)) {
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

  // Validate and sanitize agentAccess
  if (!Array.isArray(agentAccess)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'agentAccess must be an array'
    })
  }
  const sanitizedAgentAccess = agentAccess
    .map((id) => sanitizeObjectId(id))
    .filter(Boolean)

  try {
    // Check if any user already exists with this email (active or inactive)
    const existingUser = await User.findOne({ email: sanitizedEmail })
    
    if (existingUser) {
      if (existingUser.isActive) {
        // Active user exists - cannot invite
        throw createError({
          statusCode: 409,
          statusMessage: 'User with this email already exists'
        })
      } else {
        // Inactive user exists - delete it so we can create a new one
        console.log('Removing inactive user to allow new invitation')
        await User.findByIdAndDelete(existingUser._id)
      }
    }

    // Generate a temporary password (user will need to reset it)
    const tempPassword = Math.random().toString(36).slice(-12)
    
    // Create new user
    const newUser = new User({
      email: sanitizedEmail,
      name: sanitizedName,
      password: tempPassword, // Will be hashed by the pre-save hook
      role,
      agentAccess: sanitizedAgentAccess,
      invitedBy: user._id,
      isActive: false // User starts inactive until they complete setup
    })

    // Generate invitation token
    const invitationToken = newUser.createInvitationToken()
    
    await newUser.save()

    // Populate the response
    await newUser.populate('invitedBy', 'name email')
    await newUser.populate('agentAccess', 'name')

    // Send invitation email
    try {
      const emailSent = await emailService.sendInvitationEmail(
        newUser.email,
        newUser.name,
        user.name,
        invitationToken
      )

      if (!emailSent) {
        console.warn(`Invitation email could not be sent to ${newUser.email}`)
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the user creation if email fails
    }

    return {
      success: true,
      data: newUser,
      message: 'User invited successfully'
    }
  } catch (error: any) {
    console.error('Invitation error details:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to invite user: ${error.message || 'Unknown error'}`
    })
  }
}) 