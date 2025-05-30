<template>
  <div>
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Agents</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Manage your AI agents and their configurations
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <button class="btn-primary opacity-50 cursor-not-allowed" disabled>
          <PlusIcon class="w-4 h-4 mr-2" />
          Create Agent
        </button>
      </div>
    </div>

    <div class="text-center py-12">
      <CpuChipIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">Agent Management</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Agent creation and management features will be implemented in the next phase.
      </p>
      <div class="mt-6">
        <NuxtLink to="/dashboard" class="btn-secondary">
          Back to Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PlusIcon, CpuChipIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script> 