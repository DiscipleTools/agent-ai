export const useApi = () => {
  const csrfTokenCache = ref(null)

  const authenticatedFetch = $fetch.create({
    async onRequest({ request, options }) {
      // Add authentication header if token exists
      const accessToken = useCookie('access-token')
      if (accessToken.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken.value}`
        }
      }

      // Add CSRF token for state-changing methods
      const method = options.method?.toUpperCase() || 'GET'
      const needsCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
      
      if (needsCSRF && accessToken.value) {
        // Skip CSRF for certain endpoints
        const skipCSRFPaths = [
          '/api/auth/login',
          '/api/auth/refresh',
          '/api/auth/setup-account',
          '/api/users/complete-setup',
          '/api/users/validate-invitation',
          '/api/health',
          '/api/rag/health',
          '/api/rag/test-connection'
        ]

        const requestPath = typeof request === 'string' ? request.split('?')[0] : ''
        const shouldSkipCSRF = skipCSRFPaths.some(path => requestPath === path) ||
                              requestPath.includes('/webhook/')

        if (!shouldSkipCSRF) {
          // Check if CSRF token is already provided in headers or body
          const hasCSRFInHeaders = options.headers?.['X-CSRF-Token'] || 
                                  options.headers?.['X-XSRF-Token'] ||
                                  options.headers?.['x-csrf-token'] ||
                                  options.headers?.['x-xsrf-token']

          let hasCSRFInBody = false
          if (options.body && typeof options.body === 'object') {
            if (options.body instanceof FormData) {
              hasCSRFInBody = options.body.has('csrfToken') || options.body.has('_token')
            } else {
              hasCSRFInBody = options.body.csrfToken || options.body._token
            }
          }

          if (!hasCSRFInHeaders && !hasCSRFInBody) {
            try {
              // Get cached token or fetch new one
              if (!csrfTokenCache.value) {
                const response = await $fetch('/api/auth/csrf-token', {
                  headers: {
                    Authorization: `Bearer ${accessToken.value}`
                  }
                })
                csrfTokenCache.value = response.data?.csrfToken || response.csrfToken
              }

              if (csrfTokenCache.value) {
                options.headers = {
                  ...options.headers,
                  'X-CSRF-Token': csrfTokenCache.value
                }
              }
            } catch (csrfError) {
              console.warn('Failed to get CSRF token:', csrfError)
              // Continue without CSRF token - let the server handle the error
            }
          }
        }
      }
    },

    onResponseError({ response }) {
      // Handle 401 errors by redirecting to login
      if (response.status === 401) {
        // Clear tokens and CSRF cache
        const accessToken = useCookie('access-token')
        const refreshToken = useCookie('refresh-token')
        accessToken.value = null
        refreshToken.value = null
        csrfTokenCache.value = null
        
        // Redirect to login
        navigateTo('/login')
      }

      // Handle CSRF token expiration
      if (response.status === 403 && 
          (response._data?.statusMessage?.includes('CSRF') || 
           response.statusText?.includes('CSRF'))) {
        // Clear cached CSRF token to force refresh on next request
        csrfTokenCache.value = null
      }
    }
  })

  // Helper function to clear CSRF cache (useful for login/logout)
  const clearCSRFCache = () => {
    csrfTokenCache.value = null
  }

  return {
    $api: authenticatedFetch,
    clearCSRFCache
  }
} 