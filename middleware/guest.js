export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  
  // If user is authenticated, redirect to agents
  if (authStore.isAuthenticated) {
    return navigateTo('/agents')
  }
}) 