<template>
  <div>
    <div class="sm:flex sm:items-center sm:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Response Agents</h1>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Manage your AI response agents for Chatwoot inboxes. Each inbox can have only one response agent.
        </p>
      </div>
      <div class="mt-4 sm:mt-0">
        <button
          @click="refreshChatwootData"
          :disabled="chatwootStore.loading"
          class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <ArrowPathIcon class="w-4 h-4 mr-2" :class="{ 'animate-spin': chatwootStore.loading }" />
          Refresh Inboxes
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading && !agentsStore.agents.length" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ sanitizeErrorMessage(agentsStore.error) }}</div>
      <button @click="fetchAgents" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Chatwoot Session Check -->
    <div v-else-if="!chatwootStore.hasChatwootSession" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="w-6 h-6 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">No Chatwoot Session</h3>
          <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            You need to be logged into Chatwoot to manage agents for inboxes. Please log into Chatwoot first.
          </p>
          <a 
            :href="chatwootStore.chatwootUrl" 
            target="_blank"
            class="mt-3 inline-flex items-center px-3 py-2 border border-yellow-300 dark:border-yellow-600 shadow-sm text-sm leading-4 font-medium rounded-md text-yellow-700 dark:text-yellow-200 bg-white dark:bg-yellow-900/20 hover:bg-yellow-50 dark:hover:bg-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            <ArrowTopRightOnSquareIcon class="w-4 h-4 mr-2" />
            Open Chatwoot
          </a>
        </div>
      </div>
    </div>

    <!-- Chatwoot Inboxes Section -->
    <div v-else-if="chatwootStore.getAdminInboxes.length > 0" class="space-y-8">
      <!-- Inboxes Grid -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Chatwoot Inboxes</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create and manage AI response agents for your Chatwoot inboxes
          </p>
        </div>
        <div class="p-6">
          <div v-if="chatwootStore.getAdminInboxes.length === 0 && chatwootStore.getAllInboxes.length > 0" class="text-center py-12">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20">
              <ExclamationTriangleIcon class="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No Administrator Access</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You need administrator access to create agents for inboxes. 
              Contact your Chatwoot account admin to get the required permissions.
            </p>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="inbox in chatwootStore.getAdminInboxes"
              :key="`${inbox.accountId}-${inbox.id}`"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center space-x-2">
                  <div class="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <InboxIcon class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ sanitizeText(inbox.name) }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ sanitizeText(inbox.channel_type) }}</p>
                  </div>
                </div>
              </div>
              
              <div class="space-y-2 mb-4">
                <div class="flex flex-wrap gap-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                    {{ sanitizeText(inbox.accountName) }}
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200">
                    ID: {{ inbox.id }}
                  </span>
                </div>
              </div>

              <!-- Agent for this inbox -->
              <div class="mb-4">
                <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Response Agent:</div>
                <div v-if="getAgentsForInbox(inbox.accountId, inbox.id).length > 0" class="space-y-3">
                  <div 
                    v-for="agent in getAgentsForInbox(inbox.accountId, inbox.id)"
                    :key="agent._id"
                    class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800"
                  >
                    <!-- Agent Header -->
                    <div class="flex items-start justify-between mb-2">
                      <div class="min-w-0 flex-1">
                        <h4 class="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                          {{ sanitizeText(agent.name) }}
                        </h4>
                        <div class="flex items-center space-x-2 mt-1">
                          <span class="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded-full">
                            {{ agent.agentType || 'response' }}
                          </span>
                          <span 
                            :class="[
                              'inline-block px-2 py-0.5 text-xs font-medium rounded-full',
                              agent.isActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            ]"
                          >
                            {{ agent.isActive ? 'Active' : 'Inactive' }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Agent Description -->
                    <p v-if="agent.description" class="text-xs text-green-700 dark:text-green-300 mb-3 line-clamp-2">
                      {{ sanitizeText(agent.description) }}
                    </p>
                    
                    <!-- Agent Actions -->
                    <div class="flex space-x-2">
                      <button
                        @click="editAgent(agent)"
                        class="flex-1 inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-white dark:bg-green-900/10 border border-green-300 dark:border-green-700 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <PencilIcon class="w-3 h-3 mr-1" />
                        Edit
                      </button>
                      <button
                        @click="deleteAgent(agent._id)"
                        class="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-white dark:bg-red-900/10 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  No response agent assigned
                </div>
              </div>

              <button
                v-if="getAgentsForInbox(inbox.accountId, inbox.id).length === 0"
                @click="createAgentForInbox(inbox)"
                class="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <PlusIcon class="w-4 h-4 mr-2" />
                Create Response Agent
              </button>
              <div 
                v-else
                class="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Response Agent Assigned
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Inboxes State -->
    <div v-else-if="chatwootStore.hasChatwootSession && chatwootStore.getAllInboxes.length === 0" class="text-center py-12">
      <InboxIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Chatwoot inboxes found</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Please ensure you have access to Chatwoot inboxes or refresh your Chatwoot data.
      </p>
      <div class="mt-6">
        <button
          @click="refreshChatwootData"
          class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ArrowPathIcon class="w-4 h-4 mr-2" />
          Refresh Chatwoot Data
        </button>
      </div>
    </div>

    <!-- Default Empty State -->
    <div v-else class="text-center py-12">
      <CpuChipIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Chatwoot inboxes available</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Response agents are created for specific Chatwoot inboxes. Each inbox can have one response agent.
      </p>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Please ensure you have access to Chatwoot inboxes or refresh your Chatwoot data.
      </p>
    </div>
  </div>
</template>

<script setup>
import { 
  PlusIcon, 
  CpuChipIcon, 
  InboxIcon, 
  ArrowPathIcon, 
  ExclamationTriangleIcon, 
  ArrowTopRightOnSquareIcon,
  PencilIcon 
} from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import { useChatwootStore } from '~/stores/chatwoot'
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeErrorMessage } from '~/utils/sanitize'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const agentsStore = useAgentsStore()
const chatwootStore = useChatwootStore()
const toast = useToast()

const fetchAgents = async () => {
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    console.error('Failed to load agents:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to load agents', { type: 'error' })
  }
}

const createAgentForInbox = (inbox) => {
  // Navigate to create page with inbox info in query params
  navigateTo({
    path: '/agents/create',
    query: {
      accountId: inbox.accountId,
      accountName: inbox.accountName,
      inboxId: inbox.id,
      inboxName: inbox.name,
      channelType: inbox.channel_type
    }
  })
}

const refreshChatwootData = async () => {
  try {
    await chatwootStore.loadProfile()
    if (chatwootStore.accounts.length > 0) {
      await chatwootStore.loadAllInboxes()
    }
    toast('Chatwoot data refreshed successfully', { type: 'success' })
  } catch (error) {
    console.error('Failed to refresh Chatwoot data:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to refresh Chatwoot data', { type: 'error' })
  }
}

const getAgentsForInbox = (accountId, inboxId) => {
  return agentsStore.agents.filter(agent => 
    agent.inboxes && agent.inboxes.some(inbox => 
      inbox.accountId === accountId && inbox.inboxId === inboxId
    )
  )
}

const editAgent = (agent) => {
  // Validate agent ID before navigation
  const agentId = sanitizeText(agent._id)
  if (!agentId || agentId.length !== 24) {
    toast('Invalid agent ID', { type: 'error' })
    return
  }
  navigateTo(`/agents/${agentId}`)
}

const deleteAgent = async (agentId) => {
  // Validate agent ID before deletion
  const sanitizedAgentId = sanitizeText(agentId)
  if (!sanitizedAgentId || sanitizedAgentId.length !== 24) {
    toast('Invalid agent ID', { type: 'error' })
    return
  }
  
  if (!confirm('Are you sure you want to delete this agent?')) return
  
  try {
    await agentsStore.deleteAgent(sanitizedAgentId)
    toast('Agent deleted successfully', { type: 'success' })
  } catch (error) {
    console.error('Failed to delete agent:', sanitizeErrorMessage(error))
    toast(sanitizeErrorMessage(error) || 'Failed to delete agent', { type: 'error' })
  }
}

// Initialize data on mount
onMounted(async () => {
  // Start both operations in parallel
  const promises = [
    fetchAgents(),
    chatwootStore.checkChatwootSession() ? chatwootStore.loadProfile().then(() => {
      if (chatwootStore.accounts.length > 0) {
        return chatwootStore.loadAllInboxes()
      }
    }).catch(error => {
      console.warn('Chatwoot profile loading failed (this is expected if Chatwoot is not configured):', error.message)
      // Don't throw the error, just log it
    }) : Promise.resolve()
  ]
  
  await Promise.allSettled(promises)
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 