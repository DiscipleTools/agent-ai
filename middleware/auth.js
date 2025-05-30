export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  const accessToken = useCookie('access-token')

  // If no token, redirect to login
  if (!accessToken.value) {
    return navigateTo('/login')
  }

  // If no user data and we have a token, something went wrong
  if (!authStore.user && accessToken.value) {
    return navigateTo('/login')
  }
}) 