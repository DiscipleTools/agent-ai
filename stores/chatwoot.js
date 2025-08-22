import { defineStore } from 'pinia'

export const useChatwootStore = defineStore('chatwoot', () => {
  const profile = ref(null)
  const accounts = ref([])
  const inboxesByAccount = ref({})
  const loading = ref(false)
  const error = ref(null)
  const hasChatwootSession = ref(false)
  const chatwootUrl = ref('/')

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
      return null
    }
  }

  // Load Chatwoot profile and accounts
  const loadProfile = async () => {
    loading.value = true
    error.value = null
    
    try {
      const sessionData = parseChatwootSession()
      
      if (!sessionData) {
        hasChatwootSession.value = false
        loading.value = false
        return
      }

      hasChatwootSession.value = true

      // Call our API endpoint to get Chatwoot profile
      const response = await $api('/api/chatwoot/profile', {
        method: 'GET'
      })

      if (response.success) {
        profile.value = response.data.profile
        accounts.value = response.data.accounts || []
        chatwootUrl.value = response.data.chatwootUrl || '/'
        return response.data
      } else {
        throw new Error(response.message || 'Failed to load profile')
      }
    } catch (e) {
      console.error('Error loading Chatwoot profile:', e)
      error.value = e.message || 'Failed to load Chatwoot profile'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Load inboxes for a specific account
  const loadInboxes = async (accountId) => {
    if (!accountId) {
      throw new Error('Account ID is required')
    }

    try {
      const response = await $api(`/api/chatwoot/accounts/${accountId}/inboxes`, {
        method: 'GET'
      })

      if (response.success) {
        inboxesByAccount.value = { 
          ...inboxesByAccount.value, 
          [accountId]: response.data 
        }
        return response.data
      } else {
        throw new Error(response.message || 'Failed to load inboxes')
      }
    } catch (e) {
      console.error('Error loading inboxes:', e)
      throw e
    }
  }

  // Load all inboxes for all accounts
  const loadAllInboxes = async () => {
    if (!accounts.value || accounts.value.length === 0) {
      await loadProfile()
    }

    const promises = accounts.value.map(account => loadInboxes(account.id))
    await Promise.all(promises)
  }

  // Get all inboxes across all accounts as a flat array
  const getAllInboxes = computed(() => {
    const allInboxes = []
    for (const [accountId, inboxes] of Object.entries(inboxesByAccount.value)) {
      if (Array.isArray(inboxes)) {
        allInboxes.push(...inboxes.map(inbox => ({
          ...inbox,
          accountId: parseInt(accountId),
          accountName: accounts.value.find(acc => acc.id === parseInt(accountId))?.name || `Account ${accountId}`
        })))
      }
    }
    return allInboxes
  })

  // Check if user has Chatwoot session and is authenticated
  const checkChatwootSession = () => {
    const sessionData = parseChatwootSession()
    hasChatwootSession.value = !!sessionData
    return hasChatwootSession.value
  }

  // Reset store state
  const resetState = () => {
    profile.value = null
    accounts.value = []
    inboxesByAccount.value = {}
    loading.value = false
    error.value = null
    hasChatwootSession.value = false
    chatwootUrl.value = '/'
  }

  return {
    // State
    profile: readonly(profile),
    accounts: readonly(accounts),
    inboxesByAccount: readonly(inboxesByAccount),
    loading: readonly(loading),
    error: readonly(error),
    hasChatwootSession: readonly(hasChatwootSession),
    chatwootUrl: readonly(chatwootUrl),
    
    // Computed
    getAllInboxes,
    
    // Actions
    loadProfile,
    loadInboxes,
    loadAllInboxes,
    checkChatwootSession,
    resetState
  }
})
