const isValidToken = (token) => {
  if (!token || typeof token !== 'string') return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  const accessToken = useCookie('access-token')

  // If no token or invalid token, redirect to login
  if (!accessToken.value || !isValidToken(accessToken.value)) {
    accessToken.value = null
    return navigateTo('/login')
  }

  // If no user data and we have a valid token, something went wrong
  if (!authStore.user && accessToken.value) {
    return navigateTo('/login')
  }
}) 