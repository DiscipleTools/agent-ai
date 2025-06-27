<template>
  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            User
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Role
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Status
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Invited By
          </th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Created
          </th>
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        <tr v-for="user in validatedUsers" :key="user._id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="flex-shrink-0 h-10 w-10">
                <div class="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
                    {{ getSafeInitial(user.name) }}
                  </span>
                </div>
              </div>
              <div class="ml-4">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ sanitizeText(user.name) }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ sanitizeEmail(user.email) }}
                </div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span 
              :class="[
                'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                user.role === 'admin' 
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              ]"
            >
              {{ sanitizeText(user.role) }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span 
              :class="[
                'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                user.isActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              ]"
            >
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {{ sanitizeText(user.invitedBy?.name || 'System') }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(user.createdAt) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex items-center justify-end space-x-2">
              <button
                @click="$emit('edit', user)"
                class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                title="Edit user"
              >
                <PencilIcon class="h-4 w-4" />
              </button>
              <button
                @click="$emit('toggle-status', user._id)"
                :class="[
                  'hover:opacity-75',
                  user.isActive 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                ]"
                :title="user.isActive ? 'Deactivate user' : 'Activate user'"
              >
                <component :is="user.isActive ? XMarkIcon : CheckIcon" class="h-4 w-4" />
              </button>
              <button
                @click="$emit('delete', user._id)"
                class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                title="Delete user"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/vue/24/outline'
import { sanitizeText, sanitizeEmail } from '~/utils/sanitize'

const props = defineProps({
  users: {
    type: Array,
    required: true
  }
})

defineEmits(['edit', 'delete', 'toggle-status'])

// Validate and sanitize user data
const validatedUsers = computed(() => {
  return props.users.filter(isValidUser)
})

const isValidUser = (user) => {
  return user && 
         user._id && 
         typeof user.name === 'string' && 
         typeof user.email === 'string' &&
         typeof user.role === 'string' &&
         typeof user.isActive === 'boolean'
}

const getSafeInitial = (name) => {
  const sanitized = sanitizeText(name)
  return sanitized ? sanitized.charAt(0).toUpperCase() : '?'
}

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString()
  } catch {
    return 'Invalid Date'
  }
}
</script> 