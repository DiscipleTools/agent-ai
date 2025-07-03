import { authMiddleware } from '~/server/utils/auth'
import emailService from '~/server/services/emailService'

export default authMiddleware.admin(async (event, checker) => {
  // Get user from checker
  const user = checker.user

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