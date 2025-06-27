<template>
  <div v-if="settingsStore.settings?.updatedBy" class="card">
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
      Settings Information
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <span class="text-gray-600 dark:text-gray-400">Last updated by:</span>
        <span class="ml-2 font-medium text-gray-900 dark:text-white">
          {{ settingsStore.settings.updatedBy.name }}
        </span>
      </div>
      <div>
        <span class="text-gray-600 dark:text-gray-400">Last updated:</span>
        <span class="ml-2 font-medium text-gray-900 dark:text-white">
          {{ formatDate(settingsStore.settings.updatedAt) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
const settingsStore = useSettingsStore()

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}
</script> 