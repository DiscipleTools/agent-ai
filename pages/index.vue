<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
</template>

<script setup>
import { sanitizeErrorMessage } from '~/utils/sanitize.js'

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const authStore = useAuthStore()

onMounted(async () => {
  // If user is authenticated, redirect to agents
  if (authStore.isAuthenticated) {
    await navigateTo('/agents')
    return
  }

  // If no user data but we made it here (token exists and is valid), fetch user
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
      await navigateTo('/agents')
    } catch (error) {
      console.warn('Auth failed:', sanitizeErrorMessage(error))
      const accessToken = useCookie('access-token')
      accessToken.value = null
      await navigateTo('/login')
    }
  } else {
    await navigateTo('/login')
  }
})
</script> 