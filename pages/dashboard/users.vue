<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Manage users and their permissions
      </p>
    </div>

    <div class="card">
      <div class="text-center py-12">
        <UsersIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">User Management</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          User management functionality will be implemented in the next phase.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { UsersIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'admin']
})
</script> 