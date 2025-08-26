/**
 * @description POST /api/settings/test-email
 * Sends a test email to the authenticated user to verify email settings.
 */
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import emailService from '~/server/services/emailService'
import { sanitizeEmail } from '~/utils/sanitize'

export default chatwootAuthMiddleware.superAdmin(async (event, checker) => {
  // Get user from checker
  const user = checker.user
  const sanitizedEmail = sanitizeEmail(user.email)

  try {
    // Send test email to the current user
    const result = await emailService.testEmailConfiguration(sanitizedEmail)
    
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