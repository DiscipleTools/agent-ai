export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()

  // If user state is not populated, try to fetch it.
  // The browser will automatically send the httpOnly cookie.
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      // This is expected if the user is not logged in.
      // The error is already handled in the authStore's fetchUser method.
      // We don't need to do anything here.
    }
  }
}) 