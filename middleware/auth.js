export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  const accessToken = useCookie('access-token')

  // If no token, redirect to login
  if (!accessToken.value) {
    return navigateTo('/login')
  }

  // If user data not loaded, try to fetch it
  if (!authStore.user && accessToken.value) {
    authStore.fetchUser().catch(() => {
      // If fetch fails, redirect to login
      return navigateTo('/login')
    })
  }
}) 