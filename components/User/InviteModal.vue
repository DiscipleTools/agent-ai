<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div 
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900 sm:mx-0 sm:h-10 sm:w-10">
              <UserPlusIcon class="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Invite New User
              </h3>
              <div class="mt-4">
                <form @submit.prevent="handleSubmit" class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      v-model="form.email"
                      type="email"
                      required
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role
                    </label>
                    <select
                      v-model="form.role"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div v-if="availableAgents.length > 0">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Agent Access
                    </label>
                    <div class="space-y-2 max-h-32 overflow-y-auto">
                      <label 
                        v-for="agent in availableAgents" 
                        :key="agent._id"
                        class="flex items-center"
                      >
                        <input
                          type="checkbox"
                          :value="agent._id"
                          v-model="form.agentAccess"
                          class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {{ agent.name }}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div v-if="error" class="text-red-600 dark:text-red-400 text-sm">
                    {{ error }}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            @click="handleSubmit"
            :disabled="loading"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Inviting...
            </span>
            <span v-else>Send Invitation</span>
          </button>
          <button
            @click="$emit('close')"
            type="button"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { UserPlusIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  availableAgents: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'submit'])

const form = ref({
  name: '',
  email: '',
  role: 'user',
  agentAccess: []
})

const loading = ref(false)
const error = ref('')

const handleSubmit = async () => {
  if (!form.value.name || !form.value.email) {
    error.value = 'Name and email are required'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await emit('submit', { ...form.value })
    // Don't reset form here - let the parent handle success/failure
    // Form will be reset when modal closes
  } catch (err) {
    error.value = err.message || 'Failed to invite user'
  } finally {
    loading.value = false
  }
}

// Reset form when modal closes
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    form.value = {
      name: '',
      email: '',
      role: 'user',
      agentAccess: []
    }
    error.value = ''
    loading.value = false
  }
})
</script> 