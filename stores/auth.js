import { defineStore } from 'pinia'
import { sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isSuperAdmin = computed(() => {
    // Check if user has super admin role from Chatwoot profile
    return user.value?.superadmin === true
  })
  const loading = ref(false)

  const router = useRouter()
  const { $api, clearCSRFCache } = useApi()

  const login = async (credentials) => {
    // Login is handled by Chatwoot - redirect to main app
    // This function is kept for compatibility but shouldn't be used
    console.warn('Login should be handled by Chatwoot, not Agent AI')
    window.location.href = '/'
    return { success: false, message: 'Please log in through Chatwoot' }
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

  // Note: Token refresh not needed with Chatwoot authentication
  // Chatwoot handles its own session management

  const updateProfile = async (profileData) => {
    // Profile updates should be handled in Chatwoot
    // This function is kept for compatibility but redirects to Chatwoot profile
    console.warn('Profile updates should be handled in Chatwoot')
    window.location.href = '/app/accounts/1/profile/settings'
    return { success: false, message: 'Please update your profile in Chatwoot' }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    loading: readonly(loading),
    login,
    logout,
    fetchUser,
    updateProfile
  }
}) 