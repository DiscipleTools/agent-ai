const hasChatwootSession = () => {
  try {
    const sessionCookie = useCookie('cw_d_session_info')
    if (!sessionCookie.value) return false
    
    // Check if the cookie has the required structure
    let sessionData
    if (typeof sessionCookie.value === 'object') {
      sessionData = sessionCookie.value
    } else if (typeof sessionCookie.value === 'string') {
      try {
        const decodedCookie = decodeURIComponent(sessionCookie.value)
        sessionData = JSON.parse(decodedCookie)
      } catch {
        return false
      }
    } else {
      return false
    }
    
    // Check for required Chatwoot session fields
    return !!(sessionData['access-token'] && sessionData.client && sessionData.uid)
  } catch {
    return false
  }
}

export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore()

  // Check for Chatwoot session instead of Agent AI JWT token
  if (!hasChatwootSession()) {
    // Redirect to Chatwoot login (which will be the main app root)
    return navigateTo('/')
  }

  // If no user data but we have a valid Chatwoot session, try to fetch user
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      console.error('Failed to fetch user with Chatwoot session:', error)
      return navigateTo('/')
    }
  }
}) 