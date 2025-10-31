<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Loading State -->
    <div v-if="loading && !currentInbox" class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p class="text-gray-500 mt-2">Loading inbox details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading inbox</h3>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
          <button
            @click="refreshInbox"
            class="text-sm text-red-800 underline mt-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>

    <!-- Inbox Details -->
    <div v-else-if="currentInbox">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center space-x-4">
          <button
            @click="router.push('/inboxes')"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeftIcon class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ currentInbox.name }}</h1>
            <p class="text-gray-600 mt-1">{{ formatChannelType(currentInbox.channelType) }}</p>
          </div>
        </div>

        <div v-if="isBotSetup" class="flex items-center space-x-3">
          <button
            @click="createAgent"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Create New Agent
          </button>
          <button
            @click="showSelectAgent"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Select Existing Agent
          </button>
        </div>
      </div>


      <!-- Bot Setup Required -->
      <div v-if="!isBotSetup" class="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <UserIcon class="w-8 h-8 text-blue-600" />
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-3">Integration Setup Required</h3>
          <p class="text-gray-600 mb-6 max-w-md mx-auto">
            Before you can create agents, you need to set up the Chatwoot integration for this inbox.
          </p>
          <button
            @click="setupIntegration"
            :disabled="setupLoading"
            class="px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ setupLoading ? 'Setting up...' : 'Setup Integration to Build Agents' }}
          </button>
        </div>
      </div>

      <!-- Agents List -->
      <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-medium text-gray-900">Agents</h3>
        </div>

        <div v-if="allAgents.length > 0" class="space-y-3">
          <div 
            v-for="(agent, index) in allAgents" 
            :key="agent.id"
            :draggable="true"
            @dragstart="onDragStart(index)"
            @dragover.prevent
            @drop="onDrop(index)"
            class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-move transition-colors"
          >
            <div class="flex items-center space-x-3">
              <div class="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                {{ index + 1 }}
              </div>
              <div>
                <p class="font-medium text-gray-900">{{ agent.name }}</p>
                <p class="text-sm text-gray-500">{{ agent.type || 'Agent' }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="editAgent(agent)"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Edit
              </button>
              <button
                @click="deleteAgent(agent)"
                class="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-12">
          <UserIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p class="text-gray-500 mb-6">No agents configured for this inbox</p>
          <div class="flex items-center justify-center space-x-4">
            <button
              @click="createAgent"
              class="px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Create New Agent
            </button>
            <button
              @click="showSelectAgent"
              class="px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              Select Existing Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Select Agent Modal -->
  <div v-if="showAgentModal" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="hideSelectAgent"></div>
      
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                Select an Existing Agent
              </h3>
              
              <div v-if="agentsLoading" class="text-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p class="text-gray-500 mt-2">Loading agents...</p>
              </div>
              
              <div v-else-if="availableAgents.length === 0" class="text-center py-6">
                <UserIcon class="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p class="text-gray-500 mb-4">No existing agents found</p>
                <button
                  @click="hideSelectAgent(); createAgent()"
                  class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                >
                  Create Your First Agent
                </button>
              </div>
              
              <div v-else class="space-y-2 max-h-60 overflow-y-auto">
                <div 
                  v-for="agent in availableAgents" 
                  :key="agent._id"
                  @click="selectAgent(agent)"
                  class="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="font-medium text-gray-900">{{ agent.name }}</p>
                      <p class="text-sm text-gray-500">Workflow Agent</p>
                      <p v-if="agent.description" class="text-xs text-gray-400 mt-1">{{ agent.description }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            @click="hideSelectAgent"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useToast } from 'vue-toastification'
import { useInboxesStore } from '~/stores/inboxes'
import { useAgentsStore } from '~/stores/agents'
import {
  ArrowLeftIcon,
  UserIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const route = useRoute()
const inboxId = route.params.id
const toast = useToast()

const inboxesStore = useInboxesStore()
const agentsStore = useAgentsStore()
const { currentInbox, loading, error } = storeToRefs(inboxesStore)
const { agents } = storeToRefs(agentsStore)

const draggedIndex = ref(-1)
const setupLoading = ref(false)
const showAgentModal = ref(false)
const agentsLoading = ref(false)

// Computed properties
const isBotSetup = computed(() => {
  return !!(currentInbox.value?.chatwoot?.botId && currentInbox.value?.chatwoot?.isConfigured)
})
const allAgents = computed(() => {
  const agentsList = []
  
  // Response agent functionality removed
  
  // Add processing agents
  if (currentInbox.value?.agents) {
    currentInbox.value.agents.forEach(agent => {
      agentsList.push({
        id: agent.agentId,
        name: agent.name || 'Processing Agent',
        type: 'Processing Agent',
        priority: agent.priority
      })
    })
  }
  
  return agentsList.sort((a, b) => (a.priority || 0) - (b.priority || 0))
})

const availableAgents = computed(() => {
  if (!agents.value) return []
  
  // Filter out agents that are already assigned to this inbox
  const assignedAgentIds = new Set()
  
  // Response agent functionality removed
  
  if (currentInbox.value?.agents) {
    currentInbox.value.agents.forEach(agent => {
      assignedAgentIds.add(agent.agentId)
    })
  }
  
  return agents.value.filter(agent => !assignedAgentIds.has(agent._id))
})

// Methods
const refreshInbox = async () => {
  try {
    await inboxesStore.getInbox(inboxId)
  } catch (error) {
    console.error('Failed to refresh inbox:', error)
  }
}

const createAgent = () => {
  router.push(`/list/new?inboxId=${inboxId}`)
}

const editAgent = (agent) => {
  router.push(`/list/${agent.id}`)
}

const deleteAgent = async (agent) => {
  if (!confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
    return
  }
  
  try {
    // This would need to be implemented in the store
    await inboxesStore.deleteAgent(inboxId, agent.id)
    toast('Agent deleted successfully', { type: 'success' })
    await refreshInbox()
  } catch (error) {
    console.error('Failed to delete agent:', error)
    toast('Failed to delete agent', { type: 'error' })
  }
}

// Drag and drop methods
const onDragStart = (index) => {
  draggedIndex.value = index
}

const onDrop = async (dropIndex) => {
  if (draggedIndex.value === -1 || draggedIndex.value === dropIndex) {
    return
  }
  
  try {
    // This would need to be implemented in the store to reorder agents
    await inboxesStore.reorderAgents(inboxId, draggedIndex.value, dropIndex)
    toast('Agents reordered successfully', { type: 'success' })
    await refreshInbox()
  } catch (error) {
    console.error('Failed to reorder agents:', error)
    toast('Failed to reorder agents', { type: 'error' })
  } finally {
    draggedIndex.value = -1
  }
}

const setupIntegration = async () => {
  setupLoading.value = true
  
  try {
    const result = await inboxesStore.createBot(inboxId)
    
    toast(`Integration setup successfully! Bot "${result.bot.botName}" has been created.`, { type: 'success' })
    
    // Refresh the inbox to show updated status
    await refreshInbox()
  } catch (error) {
    console.error('Failed to setup integration:', error)
    toast(`Failed to setup integration: ${error.message}`, { type: 'error' })
  } finally {
    setupLoading.value = false
  }
}

const showSelectAgent = async () => {
  showAgentModal.value = true
  agentsLoading.value = true
  
  try {
    await agentsStore.fetchAgents()
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    toast('Failed to load agents', { type: 'error' })
  } finally {
    agentsLoading.value = false
  }
}

const hideSelectAgent = () => {
  showAgentModal.value = false
}

const selectAgent = async (agent) => {
  try {
    // All agents can now be assigned to processing pipeline
    await inboxesStore.addAgent(inboxId, agent._id)
    toast(`Agent "${agent.name}" added successfully`, { type: 'success' })
    
    hideSelectAgent()
    await refreshInbox()
  } catch (error) {
    console.error('Failed to assign agent:', error)
    toast(`Failed to assign agent: ${error.message}`, { type: 'error' })
  }
}

const formatChannelType = (type) => {
  const types = {
    web_widget: 'Web Widget',
    email: 'Email',
    api: 'API',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    twitter: 'Twitter',
    telegram: 'Telegram',
    line: 'Line',
    sms: 'SMS',
    website: 'Website'
  }
  return types[type] || type
}


// Lifecycle
onMounted(async () => {
  if (inboxId) {
    await refreshInbox()
  }
})
</script>