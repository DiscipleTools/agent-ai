import { requireAuth, requireAdmin } from '~/server/utils/auth'
import emailService from '~/server/services/emailService'

export default defineEventHandler(async (event) => {
  // Require authentication and admin role
  const user = await requireAuth(event)
  await requireAdmin(event)

  try {
    // Send test email to the current user
    const result = await emailService.testEmailConfiguration(user.email)
    
    return {
      success: result.success,
      message: result.message
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to test email configuration'
    })
  }
}) 