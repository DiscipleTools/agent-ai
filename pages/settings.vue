<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Configure your Agent AI Server settings
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="initialLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="settingsStore.error && !settingsStore.settings" class="card">
      <div class="text-center py-8">
        <div class="text-red-600 dark:text-red-400 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to load settings
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4" v-text="settingsStore.error">
        </p>
        <button @click="fetchSettings" class="btn-primary">
          Try Again
        </button>
      </div>
    </div>

    <!-- Settings Components -->
    <div v-else class="space-y-6">
      <!-- AI Connections Configuration -->
      <SettingsAIConnections />

      <!-- Email Configuration -->
      <SettingsEmailConfig />

      <!-- Chatwoot Configuration -->
      <SettingsChatwootIntegration />

      <!-- Settings Info -->
      <SettingsInfo />

      <!-- RAG Health Status -->
      <SettingsRAGSystemStatus />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'admin']
})

const settingsStore = useSettingsStore()
const initialLoading = ref(true)

// Fetch settings on mount
const fetchSettings = async () => {
  try {
    await settingsStore.fetchSettings()
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  } finally {
    initialLoading.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script> 