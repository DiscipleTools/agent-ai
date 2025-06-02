<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'default'
})

const authStore = useAuthStore()

onMounted(async () => {
  // Check if user is authenticated
  const accessToken = useCookie('access-token')
  
  if (accessToken.value && !authStore.user) {
    try {
      await authStore.fetchUser()
      await navigateTo('/agents')
    } catch (error) {
      await navigateTo('/login')
    }
  } else if (authStore.isAuthenticated) {
    await navigateTo('/agents')
  } else {
    await navigateTo('/login')
  }
})
</script> 