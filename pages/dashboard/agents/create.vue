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
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create New Agent</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Configure your AI agent with custom prompts and settings
      </p>
    </div>

    <div class="max-w-4xl">
      <AgentForm @submit="handleSubmit" @cancel="handleCancel" />
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

const router = useRouter()
const agentsStore = useAgentsStore()

const handleSubmit = async (agentData) => {
  try {
    await agentsStore.createAgent(agentData)
    
    // Show success message
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.success('Agent created successfully!')
    }
    
    // Navigate back to agents list
    await router.push('/dashboard/agents')
  } catch (error) {
    console.error('Failed to create agent:', error)
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.error(error.message || 'Failed to create agent')
    }
  }
}

const handleCancel = () => {
  router.back()
}
</script> 