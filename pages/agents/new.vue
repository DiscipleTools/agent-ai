<template>
  <div>
    <div class="mb-6">
      <div class="flex items-center space-x-4 mb-4">
        <button
          @click="$router.back()"
          class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeftIcon class="w-4 h-4 mr-1" />
          Back
        </button>
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Create New Agent
      </h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Create a new AI agent that can be assigned to inboxes
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Agent Form -->
    <div v-else class="max-w-4xl">
      <AgentForm @submit="handleSubmit" @cancel="handleCancel" />
    </div>
  </div>
</template>

<script setup>
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import AgentForm from '~/components/Agent/AgentForm.vue'
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const agentsStore = useAgentsStore()
const toast = useToast()

const handleSubmit = async (agentData) => {
  try {
    await agentsStore.createAgent(agentData)
    toast.success('Agent created successfully!')
    router.push('/agents')
  } catch (error) {
    console.error('Error creating agent:', error)
    toast.error('Failed to create agent: ' + error.message)
  }
}

const handleCancel = () => {
  router.back()
}
</script>
