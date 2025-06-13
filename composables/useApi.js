export const useApi = () => {
  // Helper function to decode JWT and check expiration
  const isTokenExpiringSoon = (token) => {
    if (!token) return true
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expirationTime = payload.exp * 1000 // Convert to milliseconds
      const currentTime = Date.now()
      const timeUntilExpiry = expirationTime - currentTime
      
      // Refresh if token expires within 2 hours (for 24h tokens)
      return timeUntilExpiry < (2 * 60 * 60 * 1000)
    } catch (error) {
      console.error('Error decoding token:', error)
      return true // Assume expired if can't decode
    }
  }

  const authenticatedFetch = $fetch.create({
    async onRequest({ request, options }) {
      // Add authentication header if token exists
      const accessToken = useCookie('access-token')
      
      if (accessToken.value) {
        // Check if token is expiring soon and refresh if needed
        if (isTokenExpiringSoon(accessToken.value)) {
          try {
            const authStore = useAuthStore()
            await authStore.refreshTokens()
            // Get the new token after refresh
            const newToken = useCookie('access-token')
            if (newToken.value) {
              accessToken.value = newToken.value
            }
          } catch (error) {
            console.error('Failed to refresh token:', error)
            // Let the request proceed - it will fail with 401 and be handled below
          }
        }

        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken.value}`
        }
      }
    },

    async onResponseError({ response }) {
      // Handle 401 errors by trying to refresh token once
      if (response.status === 401) {
        const accessToken = useCookie('access-token')
        const refreshToken = useCookie('refresh-token')
        
        // Try to refresh token if we have a refresh token
        if (refreshToken.value && !response.url.includes('/api/auth/refresh')) {
          try {
            const authStore = useAuthStore()
            await authStore.refreshTokens()
            // Don't retry the request automatically - let the user retry
            return
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
          }
        }
        
        // Clear tokens and redirect to login
        accessToken.value = null
        refreshToken.value = null
        navigateTo('/login')
      }
    }
  })

  return {
    $api: authenticatedFetch
  }
} 