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
  layout: 'default'
})

const authStore = useAuthStore()
const checking = ref(false)

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

onMounted(async () => {
  if (checking.value) return
  checking.value = true

  const accessToken = useCookie('access-token')
  
  // Invalid token - clear and redirect
  if (!isValidToken(accessToken.value)) {
    accessToken.value = null
    await navigateTo('/login')
    return
  }

  // No user data - fetch it
  if (!authStore.user) {
    try {
      await authStore.fetchUser()
      await navigateTo('/agents')
    } catch (error) {
      console.warn('Auth failed:', sanitizeErrorMessage(error))
      accessToken.value = null
      await navigateTo('/login')
    }
  } else if (authStore.isAuthenticated) {
    await navigateTo('/agents')
  } else {
    await navigateTo('/login')
  }
})
</script> 