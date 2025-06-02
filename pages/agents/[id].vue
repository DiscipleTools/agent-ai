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
        {{ agent ? `Edit ${agent.name}` : 'Edit Agent' }}
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
      <div class="text-red-600 dark:text-red-400 mb-4">{{ agentsStore.error }}</div>
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

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const agentsStore = useAgentsStore()

const agent = computed(() => agentsStore.currentAgent)

const fetchAgent = async () => {
  try {
    await agentsStore.fetchAgent(route.params.id)
  } catch (error) {
    console.error('Failed to load agent:', error)
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.error('Failed to load agent')
    }
  }
}

const handleSubmit = async (agentData) => {
  try {
    await agentsStore.updateAgent(route.params.id, agentData)
    
    // Show success message
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.success('Agent updated successfully!')
    }
    
    // Navigate back to agents list
    await router.push('/agents')
  } catch (error) {
    console.error('Failed to update agent:', error)
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.error(error.message || 'Failed to update agent')
    }
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

<style scoped>
.btn-primary {
  @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style> 