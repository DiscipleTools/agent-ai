import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const loading = ref(false)

  const router = useRouter()
  const { $api } = useApi()

  const login = async (credentials) => {
    loading.value = true
    try {
      // Use regular $fetch for login since we don't have a token yet
      const { data } = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })

      user.value = data.user
      await router.push('/agents')
      return { success: true }
    } catch (error) {
      const errorMessage = error.message || error.data?.message || error.statusMessage || 'Login failed'
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      await $api('/api/auth/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear user data
      user.value = null
      await router.push('/login')
    }
  }

  const fetchUser = async () => {
    try {
      const { data } = await $api('/api/auth/me')
      user.value = data
    } catch (error) {
      console.error('Failed to fetch user:', error)
      await logout()
    }
  }

  const refreshTokens = async () => {
    try {
      const { data } = await $api('/api/auth/refresh', {
        method: 'POST'
      })
      return data.accessToken
    } catch (error) {
      await logout()
      throw error
    }
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
      const errorMessage = error.data?.message || error.message || 'Failed to update profile'
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