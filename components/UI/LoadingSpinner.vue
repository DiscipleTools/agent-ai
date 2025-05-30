<template>
  <div class="flex items-center justify-center">
    <div class="relative">
      <div class="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
      <div class="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
    </div>
    <span v-if="text" class="ml-3 text-sm text-gray-600 dark:text-gray-400">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    default: ''
  }
})
</script> 