export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  const accessToken = useCookie('access-token')

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
}) 