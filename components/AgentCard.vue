<template>
  <div class="card hover:shadow-lg transition-shadow">
    <div class="flex justify-between items-start mb-4">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ sanitizeText(agent.name) }}
        </h3>
        <span class="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full mt-1">
          {{ agent.agentType || 'response' }} agent
        </span>
      </div>
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
      {{ sanitizeText(agent.description) || 'No description provided' }}
    </p>
    
    <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
      <span>Created by {{ sanitizeText(agent.createdBy?.name) || 'Unknown' }}</span>
      <span>{{ formatDate(agent.createdAt) }}</span>
    </div>
    

    
    <div class="flex space-x-2">
      <NuxtLink
        :to="`/agents/${agent._id}`"
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
import { sanitizeText } from '~/utils/sanitize.js'

const props = defineProps({
  agent: {
    type: Object,
    required: true,
    validator: (agent) => {
      return agent && 
             typeof agent._id === 'string' && 
             typeof agent.name === 'string' &&
             agent._id.length > 0 &&
             agent.name.length > 0
    }
  }
})

const emit = defineEmits(['delete'])

const isDeleting = ref(false)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
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