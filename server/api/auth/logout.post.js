import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import authService from '~/server/services/authService'

export default authMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()
    
    // Get authenticated user
    const user = checker.user

    // Get refresh token from cookies or body
    const refreshToken = getCookie(event, 'refresh-token') || (await readBody(event))?.refreshToken

    if (refreshToken) {
      // Logout with the authenticated user's ID
      try {
        await authService.logout(user._id, refreshToken)
      } catch (error) {
        // Ignore errors during logout - we still want to clear cookies
        console.error('Logout error:', error.message)
      }
    }

    // Clear cookies
    deleteCookie(event, 'access-token')
    deleteCookie(event, 'refresh-token')

    return {
      success: true,
      message: 'Logged out successfully'
    }
  } catch (error) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required for logout'
    })
  }
}) 