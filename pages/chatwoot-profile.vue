<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Chatwoot Profile</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        View your Chatwoot user profile, accounts, and inbox access
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <span class="ml-3 text-gray-600 dark:text-gray-400">Loading Chatwoot profile...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0" />
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Profile</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          <button 
            @click="loadProfile" 
            class="mt-3 inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <ArrowPathIcon class="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- No Chatwoot Session -->
    <div v-else-if="!hasChatwootSession" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <div class="flex items-start">
        <ExclamationTriangleIcon class="w-6 h-6 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">No Chatwoot Session</h3>
          <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            You need to be logged into Chatwoot to view your profile. Please log into Chatwoot first.
          </p>
          <a 
            :href="chatwootUrl" 
            target="_blank"
            class="mt-3 inline-flex items-center px-3 py-2 border border-yellow-300 dark:border-yellow-600 shadow-sm text-sm leading-4 font-medium rounded-md text-yellow-700 dark:text-yellow-200 bg-white dark:bg-yellow-900/20 hover:bg-yellow-50 dark:hover:bg-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            <ArrowTopRightOnSquareIcon class="w-4 h-4 mr-2" />
            Open Chatwoot
          </a>
        </div>
      </div>
    </div>

    <!-- Profile Content -->
    <div v-else-if="profile" class="space-y-8">
      <!-- User Profile Card -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">User Profile</h2>
        </div>
        <div class="px-6 py-4">
          <div class="flex items-center space-x-4">
            <div class="flex-shrink-0">
              <img 
                v-if="profile.avatar_url" 
                :src="profile.avatar_url" 
                :alt="profile.name"
                class="w-16 h-16 rounded-full object-cover"
              >
              <div 
                v-else 
                class="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center"
              >
                <span class="text-xl font-medium text-primary-600 dark:text-primary-400">
                  {{ profile.name?.charAt(0)?.toUpperCase() || '?' }}
                </span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">{{ profile.name }}</h3>
              <p class="text-gray-600 dark:text-gray-400">{{ profile.email }}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  ID: {{ profile.id }}
                </span>
                <span v-if="profile.role" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                  {{ profile.role }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Accounts -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Accounts</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Chatwoot accounts you have access to
          </p>
        </div>
        <div class="px-6 py-4">
          <div v-if="accounts && accounts.length > 0" class="space-y-4">
            <div 
              v-for="account in accounts" 
              :key="account.id"
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ account.name }}</h3>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                      ID: {{ account.id }}
                    </span>
                    <span v-if="account.role" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200">
                      {{ account.role }}
                    </span>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200">
                      {{ account.status || 'active' }}
                    </span>
                  </div>
                </div>
                <button 
                  @click="loadInboxes(account.id)"
                  :disabled="loadingInboxes[account.id]"
                  class="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <InboxIcon class="w-4 h-4 mr-2" />
                  {{ loadingInboxes[account.id] ? 'Loading...' : 'View Inboxes' }}
                </button>
              </div>
              
              <!-- Inboxes for this account -->
              <div v-if="accountInboxes[account.id]" class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Inboxes</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div 
                    v-for="inbox in accountInboxes[account.id]" 
                    :key="inbox.id"
                    class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div class="flex items-center space-x-2">
                      <div class="flex-shrink-0">
                        <div class="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                          <InboxIcon class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ inbox.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ inbox.channel_type }}</p>
                      </div>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-1">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                        ID: {{ inbox.id }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8">
            <InboxIcon class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No accounts found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No Chatwoot accounts are associated with your profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { 
  ExclamationTriangleIcon, 
  ArrowPathIcon, 
  ArrowTopRightOnSquareIcon,
  InboxIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

// Reactive data
const loading = ref(true)
const error = ref(null)
const profile = ref(null)
const accounts = ref([])
const accountInboxes = ref({})
const loadingInboxes = ref({})
const hasChatwootSession = ref(false)
const chatwootUrl = ref('/')

// API instance
const { $api } = useApi()

// Parse Chatwoot session cookie
const parseChatwootSession = () => {
  const sessionCookie = useCookie('cw_d_session_info')
  if (!sessionCookie.value) {
    return null
  }

  try {
    // Check if the value is already an object
    if (typeof sessionCookie.value === 'object') {
      return sessionCookie.value
    }
    
    // Try to parse as JSON first
    if (typeof sessionCookie.value === 'string') {
      // The cookie might be URL encoded
      const decodedCookie = decodeURIComponent(sessionCookie.value)
      return JSON.parse(decodedCookie)
    }
    
    return null
  } catch (e) {
    console.error('Failed to parse Chatwoot session cookie:', e)
    console.log('Cookie value type:', typeof sessionCookie.value)
    console.log('Cookie value:', sessionCookie.value)
    return null
  }
}

// Load Chatwoot profile
const loadProfile = async () => {
  loading.value = true
  error.value = null
  
  try {
    const sessionData = parseChatwootSession()
    
    console.log('DEBUG: Session data:', sessionData)
    
    if (!sessionData) {
      console.log('DEBUG: No session data found')
      hasChatwootSession.value = false
      loading.value = false
      return
    }

    console.log('DEBUG: Found session data, calling API')
    hasChatwootSession.value = true

    // Call our API endpoint to get Chatwoot profile
    const response = await $api('/api/chatwoot/profile', {
      method: 'GET'
    })

    console.log('DEBUG: API response:', response)

    if (response.success) {
      profile.value = response.data.profile
      accounts.value = response.data.accounts || []
      chatwootUrl.value = response.data.chatwootUrl || '/'
    } else {
      throw new Error(response.message || 'Failed to load profile')
    }
  } catch (e) {
    console.error('Error loading Chatwoot profile:', e)
    console.error('Error details:', e.response?.data || e)
    error.value = e.message || 'Failed to load Chatwoot profile'
  } finally {
    loading.value = false
  }
}

// Load inboxes for a specific account
const loadInboxes = async (accountId) => {
  loadingInboxes.value = { ...loadingInboxes.value, [accountId]: true }
  
  try {
    const response = await $api(`/api/chatwoot/accounts/${accountId}/inboxes`, {
      method: 'GET'
    })

    if (response.success) {
      accountInboxes.value = { 
        ...accountInboxes.value, 
        [accountId]: response.data 
      }
    } else {
      throw new Error(response.message || 'Failed to load inboxes')
    }
  } catch (e) {
    console.error('Error loading inboxes:', e)
    // Show toast notification for error
    const toast = useNuxtApp().$toast
    if (toast) {
      toast.error(`Failed to load inboxes: ${e.message}`)
    }
  } finally {
    loadingInboxes.value = { ...loadingInboxes.value, [accountId]: false }
  }
}

// Load profile on mount
onMounted(() => {
  loadProfile()
})
</script>
