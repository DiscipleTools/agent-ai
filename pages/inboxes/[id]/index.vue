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
            <div class="flex items-center space-x-4 mt-1">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="channelTypeClass">
                {{ formatChannelType(currentInbox.channelType) }}
              </span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="statusClass">
                {{ currentInbox.isActive ? 'Active' : 'Inactive' }}
              </span>
              <SyncStatus :inbox="currentInbox" />
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            @click="testWebhook"
            :disabled="webhookTesting"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {{ webhookTesting ? 'Testing...' : 'Test Webhook' }}
          </button>
          <button
            @click="router.push(`/inboxes/${currentInbox._id}/agents`)"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Manage Agents
          </button>
          <button
            @click="router.push(`/inboxes/${currentInbox._id}/configure`)"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Configure
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <UserIcon class="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-500">Response Agent</p>
              <p class="text-lg font-semibold text-gray-900">
                {{ currentInbox.responseAgent?.agentId ? 'Assigned' : 'Not Assigned' }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <CogIcon class="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-500">Processing Agents</p>
              <p class="text-lg font-semibold text-gray-900">{{ currentInbox.agents?.length || 0 }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon class="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-500">Active Agents</p>
              <p class="text-lg font-semibold text-gray-900">
                {{ activeAgentsCount }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <GlobeAltIcon class="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div class="ml-3">
              <p class="text-sm font-medium text-gray-500">Webhook Status</p>
              <p class="text-lg font-semibold text-gray-900">
                {{ currentInbox.webhookUrl ? 'Configured' : 'Not Set' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Response Agent Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Response Agent</h3>
          
          <div v-if="currentInbox.responseAgent?.agentId" class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon class="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-900">{{ responseAgentName }}</p>
                  <p class="text-sm text-gray-500">Response Agent</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
                <button
                  @click="router.push(`/inboxes/${currentInbox._id}/agents`)"
                  class="text-blue-600 hover:text-blue-800"
                >
                  <PencilIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-600 mb-3">
              Assigned {{ formatDate(currentInbox.responseAgent.assignedAt) }}
            </p>
          </div>

          <div v-else class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <UserIcon class="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p class="text-gray-500 mb-4">No response agent assigned</p>
            <button
              @click="router.push(`/inboxes/${currentInbox._id}/agents`)"
              class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              Assign Response Agent
            </button>
          </div>
        </div>

        <!-- Processing Pipeline Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Processing Pipeline</h3>
            <button
              @click="router.push(`/inboxes/${currentInbox._id}/agents`)"
              class="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Pipeline
            </button>
          </div>

          <div v-if="currentInbox.agents && currentInbox.agents.length > 0" class="space-y-3">
            <div v-for="agent in sortedAgents" :key="agent.agentId" 
                 class="border border-gray-200 rounded-lg p-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                    {{ agent.priority }}
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">{{ agent.name }}</p>
                    <p class="text-sm text-gray-500">{{ formatAgentType(agent.agentType) }}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <span :class="agent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium">
                    {{ agent.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <CogIcon class="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p class="text-gray-500 mb-4">No processing agents configured</p>
            <button
              @click="router.push(`/inboxes/${currentInbox._id}/agents`)"
              class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
            >
              Add Processing Agents
            </button>
          </div>
        </div>

        <!-- Webhook Configuration -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <WebhookConfig :inbox="currentInbox" @test-webhook="testWebhook" />
        </div>

        <!-- Inbox Information -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Inbox Information</h3>
          
          <dl class="space-y-4">
            <div>
              <dt class="text-sm font-medium text-gray-500">Account ID</dt>
              <dd class="text-sm text-gray-900">{{ currentInbox.accountId }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Inbox ID</dt>
              <dd class="text-sm text-gray-900">{{ currentInbox.inboxId }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Channel Type</dt>
              <dd class="text-sm text-gray-900">{{ formatChannelType(currentInbox.channelType) }}</dd>
            </div>
            <div v-if="currentInbox.chatwoot?.botId">
              <dt class="text-sm font-medium text-gray-500">Bot ID</dt>
              <dd class="text-sm text-gray-900">{{ currentInbox.chatwoot.botId }}</dd>
            </div>
            <div v-if="currentInbox.chatwoot?.lastSync">
              <dt class="text-sm font-medium text-gray-500">Last Sync</dt>
              <dd class="text-sm text-gray-900">{{ formatDate(currentInbox.chatwoot.lastSync) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import WebhookConfig from '~/components/Inbox/WebhookConfig.vue'
import SyncStatus from '~/components/Inbox/SyncStatus.vue'
import {
  ArrowLeftIcon,
  UserIcon,
  CogIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  PencilIcon,
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
const { currentInbox, loading, error } = storeToRefs(inboxesStore)

const webhookTesting = ref(false)

// Computed properties
const channelTypeClass = computed(() => {
  const type = currentInbox.value?.channelType
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
  
  switch (type) {
    case 'web_widget':
      return `${baseClasses} bg-blue-100 text-blue-800`
    case 'email':
      return `${baseClasses} bg-green-100 text-green-800`
    case 'whatsapp':
      return `${baseClasses} bg-green-100 text-green-800`
    case 'api':
      return `${baseClasses} bg-purple-100 text-purple-800`
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`
  }
})

const statusClass = computed(() => {
  const isActive = currentInbox.value?.isActive
  return isActive 
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800'
})

const activeAgentsCount = computed(() => {
  if (!currentInbox.value?.agents) return 0
  let count = currentInbox.value.agents.filter(a => a.isActive).length
  if (currentInbox.value.responseAgent?.agentId) count += 1
  return count
})

const responseAgentName = computed(() => {
  // This would need to be populated from agent data
  return 'Response Agent' // Placeholder - should fetch actual agent name
})

const sortedAgents = computed(() => {
  if (!currentInbox.value?.agents) return []
  return [...currentInbox.value.agents].sort((a, b) => a.priority - b.priority)
})

// Methods
const refreshInbox = async () => {
  try {
    await inboxesStore.getInbox(inboxId)
  } catch (error) {
    console.error('Failed to refresh inbox:', error)
  }
}

const testWebhook = async () => {
  webhookTesting.value = true
  try {
    const result = await inboxesStore.testWebhook(inboxId)
    
    if (result.success) {
      alert('Webhook test successful!')
    } else {
      alert('Webhook test failed. Check the console for details.')
    }
    
    console.log('Webhook test result:', result)
  } catch (error) {
    console.error('Webhook test error:', error)
    alert('Webhook test failed with an error.')
  } finally {
    webhookTesting.value = false
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

const formatAgentType = (type) => {
  const types = {
    'pre-process': 'Pre-process',
    'analytics': 'Analytics',
    'moderation': 'Moderation',
    'routing': 'Routing',
    'post-process': 'Post-process'
  }
  return types[type] || type
}

const formatDate = (date) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Lifecycle
onMounted(async () => {
  if (inboxId) {
    await refreshInbox()
  }
})
</script>