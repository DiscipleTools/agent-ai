export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const accessToken = useCookie('access-token')

  // Helper function to decode JWT and check expiration
  const getTokenExpirationTime = (token) => {
    if (!token) return null
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 // Convert to milliseconds
    } catch (error) {
      console.error('Error decoding token:', error)
      return null
    }
  }

  // Helper function to check if token needs refresh
  const shouldRefreshToken = (token) => {
    const expirationTime = getTokenExpirationTime(token)
    if (!expirationTime) return false
    
    const currentTime = Date.now()
    const timeUntilExpiry = expirationTime - currentTime
    
    // Refresh if token expires within 2 hours (for 24h tokens)
    return timeUntilExpiry < (2 * 60 * 60 * 1000) && timeUntilExpiry > 0
  }

  // If we have a token but no user data, fetch it
  if (accessToken.value && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      // If fetch fails, the token is probably invalid
      console.error('Failed to fetch user on app init:', error)
      // Clear the invalid token
      accessToken.value = null
    }
  }

  // Set up periodic token refresh check (every 30 minutes)
  if (process.client && accessToken.value) {
    const refreshInterval = setInterval(async () => {
      const currentToken = useCookie('access-token')
      
      if (!currentToken.value || !authStore.isAuthenticated) {
        clearInterval(refreshInterval)
        return
      }

      if (shouldRefreshToken(currentToken.value)) {
        try {
          console.log('Proactively refreshing token...')
          await authStore.refreshTokens()
        } catch (error) {
          console.error('Periodic token refresh failed:', error)
          clearInterval(refreshInterval)
        }
      }
    }, 30 * 60 * 1000) // Check every 30 minutes

    // Clear interval when the app is about to be destroyed
    if (process.client) {
      window.addEventListener('beforeunload', () => {
        clearInterval(refreshInterval)
      })
    }
  }
}) 