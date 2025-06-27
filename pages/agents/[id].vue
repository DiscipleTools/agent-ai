<template>
  <div>
    <div class="mb-6">
      <div class="flex items-center space-x-4 mb-4">
        <button
          @click="$router.back()"
          class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeftIcon class="w-4 h-4 mr-1" />
          Back to Agents
        </button>
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ agent ? `Edit ${sanitizeText(agent.name)}` : 'Edit Agent' }}
      </h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Update your AI agent configuration and settings
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ sanitizeErrorMessage(agentsStore.error) }}</div>
      <button @click="fetchAgent" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Agent Form -->
    <div v-else-if="agent" class="max-w-4xl">
      <AgentForm :agent="agent" @submit="handleSubmit" @cancel="handleCancel" />
    </div>
  </div>
</template>

<script setup>
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import AgentForm from '~/components/Agent/AgentForm.vue'
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeErrorMessage } from '~/utils/sanitize'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const agentsStore = useAgentsStore()
const toast = useToast()

const agent = computed(() => agentsStore.currentAgent)

const fetchAgent = async () => {
  try {
    // Validate agent ID format
    const agentId = sanitizeText(route.params.id)
    if (!agentId || agentId.length !== 24) {
      throw new Error('Invalid agent ID format')
    }
    
    await agentsStore.fetchAgent(agentId)
  } catch (error) {
    console.error('Failed to load agent:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to load agent', { type: 'error' })
  }
}

const handleSubmit = async (agentData) => {
  try {
    // Validate agent ID format
    const agentId = sanitizeText(route.params.id)
    if (!agentId || agentId.length !== 24) {
      throw new Error('Invalid agent ID format')
    }
    
    await agentsStore.updateAgent(agentId, agentData)
    
    toast('Agent updated successfully!', { type: 'success' })
    
    // Refresh the agent data to show updated information
    await fetchAgent()
  } catch (error) {
    console.error('Failed to update agent:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to update agent', { type: 'error' })
  }
}

const handleCancel = () => {
  router.back()
}

// Fetch agent on mount
onMounted(() => {
  fetchAgent()
})
</script>

 