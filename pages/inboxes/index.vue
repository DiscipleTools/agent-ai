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

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <InboxIcon class="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-500">Total Inboxes</p>
            <p class="text-2xl font-semibold text-gray-900">{{ inboxStats.total }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircleIcon class="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-500">Active</p>
            <p class="text-2xl font-semibold text-gray-900">{{ inboxStats.active }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <CogIcon class="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-500">Configured</p>
            <p class="text-2xl font-semibold text-gray-900">{{ inboxStats.configured }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <UserIcon class="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-gray-500">With Response Agent</p>
            <p class="text-2xl font-semibold text-gray-900">{{ inboxStats.withResponseAgent }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search inboxes..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Channel Type</label>
          <select
            v-model="localFilters.channelType"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Channels</option>
            <option value="web_widget">Web Widget</option>
            <option value="email">Email</option>
            <option value="api">API</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter</option>
            <option value="telegram">Telegram</option>
            <option value="line">Line</option>
            <option value="sms">SMS</option>
            <option value="website">Website</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            v-model="localFilters.isActive"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div class="flex items-end">
          <button
            @click="applyFilters"
            class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
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

    <div v-else-if="filteredInboxes.length === 0" class="text-center py-12">
      <InboxIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No inboxes found</h3>
      <p class="text-gray-500 mb-4">
        {{ searchQuery || hasActiveFilters ? 'No inboxes match your search criteria.' : 'No inboxes found. Create inboxes in Chatwoot and they will automatically appear here.' }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <InboxCard
        v-for="inbox in filteredInboxes"
        :key="inbox._id"
        :inbox="inbox"
        @manage-agents="manageAgents"
        @configure-chatwoot="configureChatwoot"
        @test-webhook="testWebhook"
        @view-details="viewDetails"
        @create-agent="createAgentForInbox"
        @edit-agent="editAgent"
      />
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
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import { useAgentsStore } from '~/stores/agents'
import InboxCard from '~/components/Inbox/InboxCard.vue'
import {
  InboxIcon,
  CheckCircleIcon,
  CogIcon,
  UserIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const inboxesStore = useInboxesStore()
const agentsStore = useAgentsStore()
const router = useRouter()

// Destructure reactive state
const { 
  inboxes, 
  loading, 
  error, 
  pagination, 
  inboxStats 
} = storeToRefs(inboxesStore)

// Local state
const searchQuery = ref('')
const showSyncModal = ref(false)
const syncLoading = ref(false)

const localFilters = ref({
  channelType: '',
  isActive: ''
})

const syncForm = ref({
  accountId: null,
  apiKey: ''
})



// Computed
const hasActiveFilters = computed(() => {
  return Object.values(localFilters.value).some(value => value !== '')
})

const filteredInboxes = computed(() => {
  let filtered = [...inboxes.value]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(inbox => 
      inbox.name.toLowerCase().includes(query) ||
      inbox.channelType.toLowerCase().includes(query) ||
      inbox.accountId.toString().includes(query)
    )
  }

  return filtered
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
const refreshInboxes = async () => {
  await inboxesStore.fetchInboxes()
}

const applyFilters = async () => {
  inboxesStore.setFilters(localFilters.value)
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

const testWebhook = async (inbox) => {
  try {
    const result = await inboxesStore.testWebhook(inbox._id)
    
    if (result.success) {
      alert('Webhook test successful! Check the response details in the console.')
    } else {
      alert('Webhook test failed. Check the error details in the console.')
    }
    
    console.log('Webhook test result:', result)
  } catch (error) {
    console.error('Webhook test error:', error)
    alert('Webhook test failed with an error.')
  }
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



const handleSync = async () => {
  syncLoading.value = true
  
  try {
    const result = await inboxesStore.syncWithChatwoot(
      syncForm.value.accountId,
      syncForm.value.apiKey || null
    )
    
    showSyncModal.value = false
    syncForm.value = { accountId: null, apiKey: '' }
    
    alert(`Sync completed! Created: ${result.results.created.length}, Updated: ${result.results.updated.length}, Errors: ${result.results.errors.length}`)
  } catch (error) {
    console.error('Sync failed:', error)
    alert('Sync failed. Please check your credentials and try again.')
  } finally {
    syncLoading.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await refreshInboxes()
})
</script>