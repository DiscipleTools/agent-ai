<template>
  <div class="card hover:shadow-lg transition-shadow">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ agent.name }}
      </h3>
      <span 
        :class="[
          'px-2 py-1 rounded-full text-xs',
          agent.isActive 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        ]"
      >
        {{ agent.isActive ? 'Active' : 'Inactive' }}
      </span>
    </div>
    
    <p class="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
      {{ agent.description || 'No description provided' }}
    </p>
    
    <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
      <span>Created by {{ agent.createdBy?.name || 'Unknown' }}</span>
      <span>{{ formatDate(agent.createdAt) }}</span>
    </div>
    
    <div class="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-4">
      <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Webhook URL:</p>
      <div class="flex items-center space-x-2">
        <code class="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded flex-1 truncate">
          {{ agent.webhookUrl || 'Not generated' }}
        </code>
        <button
          @click="copyWebhookUrl"
          class="text-primary-600 hover:text-primary-700 text-xs"
          title="Copy URL"
        >
          <ClipboardIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
    
    <div class="flex space-x-2">
      <NuxtLink
        :to="`/dashboard/agents/${agent._id}`"
        class="flex-1 btn-primary text-center"
      >
        Edit
      </NuxtLink>
      <button
        @click="handleDelete"
        :disabled="isDeleting"
        class="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900"
      >
        {{ isDeleting ? 'Deleting...' : 'Delete' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ClipboardIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  agent: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['delete'])

const isDeleting = ref(false)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const copyWebhookUrl = async () => {
  try {
    await navigator.clipboard.writeText(props.agent.webhookUrl || '')
    // TODO: Add toast notification
    console.log('Webhook URL copied to clipboard')
  } catch (error) {
    console.error('Failed to copy URL:', error)
  }
}

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this agent?')) return
  
  isDeleting.value = true
  try {
    emit('delete', props.agent._id)
  } finally {
    isDeleting.value = false
  }
}
</script> 