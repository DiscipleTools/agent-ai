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
import { useToast } from 'vue-toastification'
import { sanitizeErrorMessage } from '~/utils/sanitize'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const agentsStore = useAgentsStore()
const toast = useToast()

const handleSubmit = async (agentData) => {
  try {
    const route = useRoute()
    const { useInboxesStore } = await import('~/stores/inboxes')
    const inboxesStore = useInboxesStore()
    
    // Import the same CSRF request function used by the agents store
    const { useCsrf } = await import('~/composables/useCsrf')
    const { csrfRequest } = useCsrf()
    
    const inboxId = route.query.inboxId
    
    // Create the agent first
    const agent = await agentsStore.createAgent(agentData)
    
    // If inboxId is provided, assign the agent to that inbox
    if (inboxId && agent) {
      try {
        if (agent.agentType === 'response') {
          // Assign as response agent
          await csrfRequest(`/api/inboxes/${inboxId}/agents/response`, {
            method: 'PUT',
            body: {
              agentId: agent._id,
              config: {}
            }
          })
        } else {
          // Add to processing pipeline
          await csrfRequest(`/api/inboxes/${inboxId}/agents`, {
            method: 'POST',
            body: {
              agentId: agent._id,
              priority: 100,
              config: {}
            }
          })
        }
        
        toast('Agent created and assigned to inbox successfully!', { type: 'success' })
        
        // Refresh inbox data to show the newly assigned agent
        await inboxesStore.fetchInboxes()
        
        // Navigate back to inbox list
        await router.push('/inboxes')
      } catch (assignError) {
        console.error('Failed to assign agent to inbox:', assignError)
        const errorMessage = assignError.data?.message || assignError.message || 'Unknown error'
        toast(`Agent created but failed to assign to inbox: ${errorMessage}`, { type: 'warning' })
        await router.push('/agents')
      }
    } else {
      toast('Agent created successfully!', { type: 'success' })
      await router.push('/agents')
    }
  } catch (error) {
    console.error('Failed to create agent:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to create agent', { type: 'error' })
  }
}

const handleCancel = () => {
  router.back()
}
</script> 