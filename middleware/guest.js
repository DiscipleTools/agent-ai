export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()
  
  // If user is authenticated, redirect to inboxes
  if (authStore.isAuthenticated) {
    return navigateTo('/inboxes')
  }
}) 