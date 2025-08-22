import { defineStore } from 'pinia'
import { sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const loading = ref(false)

  const router = useRouter()
  const { $api, clearCSRFCache } = useApi()

  const login = async (credentials) => {
    loading.value = true
    try {
      // Sanitize inputs
      const sanitizedCredentials = {
        email: sanitizeEmail(credentials.email),
        password: credentials.password // Don't sanitize passwords
      }

      // Validate sanitized inputs
      if (!sanitizedCredentials.email || !sanitizedCredentials.password) {
        throw new Error('Valid email and password are required')
      }

      // Use regular $fetch for login since we don't have a token yet
      const { data } = await $fetch('/api/auth/login', {
        method: 'POST',
        body: sanitizedCredentials
      })

      user.value = data.user
      
      // Clear CSRF cache to ensure fresh token on next request
      clearCSRFCache()
      
      await router.push('/agents')
      return { success: true }
    } catch (error) {
      const errorMessage = sanitizeErrorMessage(error)
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      // For Chatwoot authentication, we don't need to call Agent AI logout API
      // The logout should happen in Chatwoot itself
      console.log('Logout: redirecting to Chatwoot')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear user data and CSRF cache
      user.value = null
      clearCSRFCache()
      // Redirect to main Chatwoot app instead of Agent AI login
      window.location.href = '/'
    }
  }

  const fetchUser = async () => {
    try {
      const { data } = await $api('/api/auth/me')
      user.value = data
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Don't auto-logout on fetch failure - let middleware handle it
      throw error
    }
  }

  const refreshTokens = async () => {
    // No longer needed with Chatwoot authentication
    // Chatwoot handles its own session management
    console.log('Token refresh not needed with Chatwoot authentication')
    return null
  }

  const updateProfile = async (profileData) => {
    loading.value = true
    try {
      const response = await $api('/api/auth/profile', {
        method: 'PUT',
        body: profileData
      })
      
      // Update the user data with the response
      if (response.success && response.data) {
        user.value = {
          ...user.value,
          ...response.data
        }
      }
      
      return response
    } catch (error) {
      const errorMessage = sanitizeErrorMessage(error)
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isAdmin,
    loading: readonly(loading),
    login,
    logout,
    fetchUser,
    refreshTokens,
    updateProfile
  }
}) 