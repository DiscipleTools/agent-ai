<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Inboxes</h1>
        <p class="text-gray-600 mt-1">Manage your Chatwoot inboxes and agent assignments</p>
      </div>
      
      <div class="flex items-center space-x-3">
        <button
          @click="handleSync"
          :disabled="syncLoading"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {{ syncLoading ? 'Syncing...' : 'Sync with Chatwoot' }}
        </button>
      </div>
    </div>



    <!-- Inboxes Grid -->
    <div v-if="loading && inboxes.length === 0" class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p class="text-gray-500 mt-2">Loading inboxes...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading inboxes</h3>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
          <button
            @click="refreshInboxes"
            class="text-sm text-red-800 underline mt-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="inboxes.length === 0" class="text-center py-12">
      <InboxIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No inboxes found</h3>
      <p class="text-gray-500 mb-4">
        No inboxes found. Create inboxes in Chatwoot and they will automatically appear here.
      </p>
    </div>

    <!-- Inboxes Grouped by Account -->
    <div v-else class="space-y-8">
      <div v-for="(accountInboxes, accountId) in inboxesByAccount" :key="accountId" class="space-y-4">
        <!-- Account Header -->
        <div class="border-b border-gray-200 pb-2">
          <h2 class="text-xl font-semibold text-gray-900">
            {{ getAccountName(accountId) }}
          </h2>
          <p class="text-sm text-gray-600 mt-1">
            {{ accountInboxes.length }} inbox{{ accountInboxes.length !== 1 ? 'es' : '' }}
          </p>
        </div>
        
        <!-- Inboxes for this Account -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <InboxCard
            v-for="inbox in accountInboxes"
            :key="inbox._id"
            :inbox="inbox"
            @manage-agents="manageAgents"
            @configure-chatwoot="configureChatwoot"
            @view-details="viewDetails"
            @create-agent="createAgentForInbox"
            @edit-agent="editAgent"
            @enable-ai-connection="enableAiConnection"
          />
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.pages > 1" class="flex items-center justify-between mt-8">
      <div class="text-sm text-gray-700">
        Showing {{ ((pagination.page - 1) * pagination.limit) + 1 }} to 
        {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of 
        {{ pagination.total }} results
      </div>
      
      <div class="flex items-center space-x-1">
        <button
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page <= 1"
          class="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <button
          v-for="page in pageNumbers"
          :key="page"
          @click="changePage(page)"
          :class="[
            'px-3 py-2 text-sm border rounded-md',
            page === pagination.page
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 hover:bg-gray-50'
          ]"
        >
          {{ page }}
        </button>
        
        <button
          @click="changePage(pagination.page + 1)"
          :disabled="pagination.page >= pagination.pages"
          class="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>



  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import { useAgentsStore } from '~/stores/agents'
import { useAuthStore } from '~/stores/auth'
import InboxCard from '~/components/Inbox/InboxCard.vue'
import { useToast } from 'vue-toastification'
import {
  InboxIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const inboxesStore = useInboxesStore()
const agentsStore = useAgentsStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

// Destructure reactive state
const { 
  inboxes, 
  loading, 
  error, 
  pagination
} = storeToRefs(inboxesStore)

// Local state
const syncLoading = ref(false)

const syncForm = ref({
  accountId: null,
  apiKey: ''
})



// Computed
const inboxesByAccount = computed(() => {
  const grouped = {}
  
  inboxes.value.forEach(inbox => {
    const accountId = inbox.accountId
    if (!grouped[accountId]) {
      grouped[accountId] = []
    }
    grouped[accountId].push(inbox)
  })
  
  // Sort accounts by ID for consistent ordering
  const sortedAccounts = {}
  Object.keys(grouped).sort().forEach(accountId => {
    sortedAccounts[accountId] = grouped[accountId]
  })
  
  return sortedAccounts
})

const pageNumbers = computed(() => {
  const pages = []
  const totalPages = pagination.value.pages
  const currentPage = pagination.value.page
  
  // Show up to 5 page numbers
  const startPage = Math.max(1, currentPage - 2)
  const endPage = Math.min(totalPages, startPage + 4)
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  
  return pages
})

// Methods
const getAccountName = (accountId) => {
  // Try to get account name from user's Chatwoot accounts
  const userAccounts = authStore.user?.chatwoot?.accounts || []
  const account = userAccounts.find(acc => acc.id.toString() === accountId.toString())
  return account?.name || `Account ${accountId}`
}

const refreshInboxes = async () => {
  await inboxesStore.fetchInboxes()
}



const changePage = async (page) => {
  if (page >= 1 && page <= pagination.value.pages) {
    inboxesStore.setPagination({ page })
    await inboxesStore.fetchInboxes()
  }
}

// Note: Inbox editing/deletion is not supported
// Inboxes are managed through Chatwoot only

const manageAgents = (inbox) => {
  router.push(`/inboxes/${inbox._id}/agents`)
}

const configureChatwoot = (inbox) => {
  router.push(`/inboxes/${inbox._id}/configure`)
}



const viewDetails = (inbox) => {
  router.push(`/inboxes/${inbox._id}`)
}

const createAgentForInbox = (inbox) => {
  // Navigate to inbox agents page to create agent
  router.push(`/inboxes/${inbox._id}/agents`)
}

const editAgent = (agent) => {
  console.log('editAgent called with:', agent)
  
  // Navigate to agent edit page
  const agentId = agent._id || agent.id || agent
  router.push(`/agents/${agentId}`)
}

const enableAiConnection = async (inbox) => {
  try {
    const result = await inboxesStore.createBot(inbox._id)
    
    // Show success message
    toast(`AI Connection enabled successfully! Bot "${result.bot.botName}" has been created.`, { type: 'success' })
    
    // Refresh the inboxes to show updated status
    await refreshInboxes()
  } catch (error) {
    console.error('Failed to enable AI connection:', error)
    toast(`Failed to enable AI connection: ${error.message}`, { type: 'error' })
  }
}



const handleSync = async () => {
  syncLoading.value = true
  
  try {
    const result = await inboxesStore.syncWithChatwoot(
      syncForm.value.accountId,
      syncForm.value.apiKey || null
    )
    
    showSyncModal.value = false
    syncForm.value = { accountId: null, apiKey: '' }
    
    toast(`Sync completed! Created: ${result.results.created.length}, Updated: ${result.results.updated.length}, Errors: ${result.results.errors.length}`, { type: 'success' })
  } catch (error) {
    console.error('Sync failed:', error)
    toast('Sync failed. Please check your credentials and try again.', { type: 'error' })
  } finally {
    syncLoading.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await refreshInboxes()
})
</script>