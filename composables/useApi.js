export const useApi = () => {
  const authenticatedFetch = $fetch.create({
    onRequest({ request, options }) {
      // Add authentication header if token exists
      const accessToken = useCookie('access-token')
      if (accessToken.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken.value}`
        }
      }
    },

    onResponseError({ response }) {
      // Handle 401 errors by redirecting to login
      if (response.status === 401) {
        // Clear tokens
        const accessToken = useCookie('access-token')
        const refreshToken = useCookie('refresh-token')
        accessToken.value = null
        refreshToken.value = null
        
        // Redirect to login
        navigateTo('/login')
      }
    }
  })

  return {
    $api: authenticatedFetch
  }
} 