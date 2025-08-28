<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        AI Agents
      </h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Manage your AI agents that can be assigned to inboxes
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ sanitizeErrorMessage(agentsStore.error) }}</div>
      <button @click="fetchAgents" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="agents.length === 0" class="text-center py-12">
      <div class="text-gray-500 dark:text-gray-400 mb-4">No agents found</div>
      <p class="text-sm text-gray-600 dark:text-gray-500 mb-6">
        Create your first AI agent to get started
      </p>
      <NuxtLink to="/agents/new" class="btn-primary">
        Create Agent
      </NuxtLink>
    </div>

    <!-- Agents Grid -->
    <div v-else>
      <div class="flex justify-between items-center mb-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ agents.length }} {{ agents.length === 1 ? 'agent' : 'agents' }} found
        </p>
        <NuxtLink to="/agents/new" class="btn-primary">
          Create Agent
        </NuxtLink>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="agent in agents" :key="agent._id" class="card hover:shadow-lg transition-shadow">
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
              @click="handleDelete(agent._id, agent.name)"
              :disabled="deletingAgentId === agent._id"
              class="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900"
            >
              {{ deletingAgentId === agent._id ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeErrorMessage } from '~/utils/sanitize'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const agentsStore = useAgentsStore()
const toast = useToast()

const deletingAgentId = ref(null)
const agents = computed(() => agentsStore.agents)

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const fetchAgents = async () => {
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    console.error('Error fetching agents:', error)
  }
}

const handleDelete = async (agentId, agentName) => {
  if (!confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) {
    return
  }
  
  deletingAgentId.value = agentId
  try {
    await agentsStore.deleteAgent(agentId)
    toast.success(`Agent "${agentName}" deleted successfully`)
  } catch (error) {
    console.error('Error deleting agent:', error)
    toast.error(`Failed to delete agent: ${error.message}`)
  } finally {
    deletingAgentId.value = null
  }
}

// Fetch agents on mount
onMounted(() => {
  fetchAgents()
})
</script>
