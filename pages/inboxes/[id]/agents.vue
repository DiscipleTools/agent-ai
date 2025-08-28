<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Loading State -->
    <div v-if="loading && !currentInbox" class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p class="text-gray-500 mt-2">Loading agent management...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading agents</h3>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Agent Management -->
    <div v-else-if="currentInbox">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center space-x-4">
          <button
            @click="router.push(`/inboxes/${currentInbox._id}`)"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeftIcon class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Manage Agents</h1>
            <p class="text-gray-600 mt-1">{{ currentInbox.name }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            @click="showCreateAgentModal = true"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Create New Agent
          </button>
        </div>
      </div>

      <!-- Agent Assignment Component -->
      <AgentAssignment 
        :inbox="currentInbox" 
        :available-agents="availableAgents"
        @agent-assigned="handleAgentAssigned"
        @agent-removed="handleAgentRemoved"
        @agent-updated="handleAgentUpdated"
      />
    </div>

    <!-- Create Agent Modal -->
    <div v-if="showCreateAgentModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="fixed inset-0 bg-black bg-opacity-25" @click="showCreateAgentModal = false"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Create New Agent</h2>
            <button
              @click="showCreateAgentModal = false"
              class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          <div class="p-6">
            <AgentForm 
              @submit="handleCreateAgent" 
              @cancel="showCreateAgentModal = false"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import { useAgentsStore } from '~/stores/agents'
import AgentAssignment from '~/components/Inbox/AgentAssignment.vue'
import AgentForm from '~/components/Agent/AgentForm.vue'
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const route = useRoute()
const inboxId = route.params.id

const inboxesStore = useInboxesStore()
const agentsStore = useAgentsStore()

const { currentInbox, loading, error } = storeToRefs(inboxesStore)
const { agents: availableAgents } = storeToRefs(agentsStore)

// Modal state
const showCreateAgentModal = ref(false)

// Methods
const handleAgentAssigned = async () => {
  // Refresh inbox data after assignment
  await inboxesStore.getInbox(inboxId)
}

const handleAgentRemoved = async () => {
  // Refresh inbox data after removal
  await inboxesStore.getInbox(inboxId)
}

const handleAgentUpdated = async () => {
  // Refresh inbox data after update
  await inboxesStore.getInbox(inboxId)
}

const handleCreateAgent = async (agentData) => {
  try {
    // Create the agent
    const newAgent = await agentsStore.createAgent(agentData)
    
    // Close the modal
    showCreateAgentModal.value = false
    
    // Refresh available agents list
    await agentsStore.fetchAgents()
    
    // Show success message
    const { useToast } = await import('vue-toastification')
    const toast = useToast()
    toast.success('Agent created successfully! You can now assign it to this inbox.')
    
  } catch (error) {
    console.error('Error creating agent:', error)
    const { useToast } = await import('vue-toastification')
    const toast = useToast()
    toast.error('Failed to create agent: ' + error.message)
  }
}

// Lifecycle
onMounted(async () => {
  if (inboxId) {
    await Promise.all([
      inboxesStore.getInbox(inboxId),
      agentsStore.fetchAgents()
    ])
  }
})
</script>