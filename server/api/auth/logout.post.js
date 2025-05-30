import { connectDB } from '~/server/utils/db'
import AuthService from '~/server/services/authService'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get refresh token from cookies or body
    const refreshToken = getCookie(event, 'refresh-token') || (await readBody(event))?.refreshToken

    if (refreshToken) {
      // Get user ID from token (if possible)
      try {
        const authService = new AuthService()
        const decoded = await authService.verifyRefreshToken(refreshToken)
        await authService.logout(decoded.userId, refreshToken)
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
    // Always return success for logout
    deleteCookie(event, 'access-token')
    deleteCookie(event, 'refresh-token')
    
    return {
      success: true,
      message: 'Logged out successfully'
    }
  }
}) 