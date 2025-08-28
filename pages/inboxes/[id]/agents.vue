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
            @click="router.push('/agents/create')"
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import { useAgentsStore } from '~/stores/agents'
import AgentAssignment from '~/components/Inbox/AgentAssignment.vue'
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon
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