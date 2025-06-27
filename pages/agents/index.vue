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
        <button
          @click="createAgent"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Create Agent
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading && !agentsStore.agents.length" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ agentsStore.error }}</div>
      <button @click="fetchAgents" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!agentsStore.agents.length" class="text-center py-12">
      <CpuChipIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No agents</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started by creating your first AI agent.
      </p>
      <div class="mt-6">
        <button
          @click="createAgent"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <PlusIcon class="w-4 h-4 mr-2" />
          Create Agent
        </button>
      </div>
    </div>

    <!-- Agents Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="agent in agentsStore.agents"
        :key="agent._id"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
      >
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
          {{ agent.description || 'No description' }}
        </p>
        
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Created by {{ agent.createdBy?.name }}</span>
          <span>{{ formatDate(agent.createdAt) }}</span>
        </div>
        

        
        <div class="flex space-x-2">
          <button
            @click="editAgent(agent)"
            class="flex-1 btn-primary text-center"
          >
            Edit
          </button>
          <button
            @click="deleteAgent(agent._id)"
            class="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PlusIcon, CpuChipIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const agentsStore = useAgentsStore()
const toast = useToast()

const fetchAgents = async () => {
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    console.error('Failed to load agents:', error)
  }
}

const createAgent = () => {
  navigateTo('/agents/create')
}

const editAgent = (agent) => {
  navigateTo(`/agents/${agent._id}`)
}

const deleteAgent = async (agentId) => {
  if (!confirm('Are you sure you want to delete this agent?')) return
  
  try {
    await agentsStore.deleteAgent(agentId)
    toast('Agent deleted successfully', { type: 'success' })
  } catch (error) {
    console.error('Failed to delete agent:', error)
    toast('Failed to delete agent', { type: 'error' })
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

// Fetch agents on mount
onMounted(() => {
  fetchAgents()
})
</script>

<style scoped>
.btn-primary {
  @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 