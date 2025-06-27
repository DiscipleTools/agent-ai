/**
 * CSRF Token Composable
 * Simple CSRF protection for API requests
 */
export const useCsrf = () => {
  const csrfToken = ref(null)
  const { $api } = useApi()

  /**
   * Get CSRF token, fetching if needed
   */
  const getCsrfToken = async () => {
    if (csrfToken.value) {
      return csrfToken.value
    }
    
    try {
      const response = await $api('/api/auth/csrf-token')
      csrfToken.value = response.success ? response.data.csrfToken : response.csrfToken
      return csrfToken.value
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err)
      return null
    }
  }

  /**
   * Make a CSRF-protected API request
   */
  const csrfRequest = async (url, options = {}) => {
    const token = await getCsrfToken()
    if (!token) {
      throw new Error('Could not obtain CSRF token')
    }

    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        'X-CSRF-Token': token
      }
    }

    try {
      return await $api(url, requestOptions)
    } catch (err) {
      // Retry once with fresh token if CSRF error
      if (err.statusCode === 403 && err.statusMessage?.includes('CSRF')) {
        csrfToken.value = null
        const newToken = await getCsrfToken()
        if (newToken) {
          requestOptions.headers['X-CSRF-Token'] = newToken
          return await $api(url, requestOptions)
        }
      }
      throw err
    }
  }

  /**
   * Add CSRF token to form data
   */
  const addCsrfToForm = async (formData) => {
    const token = await getCsrfToken()
    if (token) {
      if (formData instanceof FormData) {
        formData.append('csrfToken', token)
      } else if (typeof formData === 'object') {
        formData.csrfToken = token
      }
    }
    return formData
  }

  return {
    getCsrfToken,
    csrfRequest,
    addCsrfToForm
  }
} 