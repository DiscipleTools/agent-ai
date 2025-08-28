import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'

export const useInboxesStore = defineStore('inboxes', () => {
  // State
  const inboxes = ref([])
  const currentInbox = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Helper function to get CSRF token
  const getCsrfToken = async () => {
    const csrfResponse = await $fetch('/api/auth/csrf-token')
    return csrfResponse.data.csrfToken
  }
  
  // Pagination state
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  // Filters state
  const filters = ref({
    accountId: null,
    channelType: null,
    isActive: 'true'
  })

  // Getters
  const getInboxById = computed(() => {
    return (id) => inboxes.value.find(inbox => inbox._id === id)
  })

  const activeInboxes = computed(() => {
    return inboxes.value.filter(inbox => inbox.isActive)
  })

  const inboxesByChannel = computed(() => {
    return (channelType) => inboxes.value.filter(inbox => inbox.channelType === channelType)
  })

  const inboxStats = computed(() => {
    const total = inboxes.value.length
    const active = inboxes.value.filter(i => i.isActive).length
    const configured = inboxes.value.filter(i => i.chatwoot?.isConfigured).length
    const withResponseAgent = inboxes.value.filter(i => i.responseAgent?.agentId).length

    return {
      total,
      active,
      inactive: total - active,
      configured,
      withResponseAgent,
      withoutResponseAgent: total - withResponseAgent
    }
  })

  // Actions

  /**
   * Fetch all inboxes with optional filters and pagination
   */
  async function fetchInboxes(options = {}) {
    loading.value = true
    error.value = null

    try {
      const query = {
        page: options.page || pagination.value.page,
        limit: options.limit || pagination.value.limit,
        ...filters.value,
        ...options.filters
      }

      // Remove null/empty filters
      Object.keys(query).forEach(key => {
        if (query[key] === null || query[key] === '' || query[key] === undefined) {
          delete query[key]
        }
      })

      const response = await $fetch('/api/inboxes', { query })

      if (response.success) {
        inboxes.value = response.data.inboxes
        pagination.value = response.data.pagination
        return response.data
      }

      throw new Error(response.message || 'Failed to fetch inboxes')
    } catch (err) {
      console.error('Error fetching inboxes:', err)
      error.value = err.message || 'Failed to fetch inboxes'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Note: Inbox creation is handled automatically through Chatwoot sync
  // Inboxes are read-only entities in this system

  /**
   * Update an existing inbox
   */
  async function updateInbox(inboxId, updateData) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}`, {
        method: 'PUT',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: updateData
      })

      if (response.success) {
        const index = inboxes.value.findIndex(inbox => inbox._id === inboxId)
        if (index !== -1) {
          inboxes.value[index] = response.data.inbox
        }
        
        if (currentInbox.value?._id === inboxId) {
          currentInbox.value = response.data.inbox
        }
        
        return response.data.inbox
      }

      throw new Error(response.message || 'Failed to update inbox')
    } catch (err) {
      console.error('Error updating inbox:', err)
      error.value = err.message || 'Failed to update inbox'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Note: Inbox deletion is not supported in this system
  // Inboxes must be deleted in Chatwoot and will be removed on next sync

  /**
   * Get detailed inbox information
   */
  async function getInbox(inboxId) {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch(`/api/inboxes/${inboxId}`)

      if (response.success) {
        currentInbox.value = response.data.inbox
        
        // Update in the list if it exists
        const index = inboxes.value.findIndex(inbox => inbox._id === inboxId)
        if (index !== -1) {
          inboxes.value[index] = response.data.inbox
        }
        
        return response.data.inbox
      }

      throw new Error(response.message || 'Failed to get inbox')
    } catch (err) {
      console.error('Error getting inbox:', err)
      error.value = err.message || 'Failed to get inbox'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Sync inboxes with Chatwoot
   */
  async function syncWithChatwoot(accountId, apiKey = null) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch('/api/inboxes/sync', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: {
          accountId,
          apiKey
        }
      })

      if (response.success) {
        // Refresh the inbox list after sync
        await fetchInboxes()
        return response.data
      }

      throw new Error(response.message || 'Failed to sync with Chatwoot')
    } catch (err) {
      console.error('Error syncing with Chatwoot:', err)
      error.value = err.message || 'Failed to sync with Chatwoot'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Test webhook for an inbox
   */
  async function testWebhook(inboxId, testData = {}) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch('/api/inboxes/test-webhook', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: {
          inboxId,
          testData
        }
      })

      return response // Return both success and failure responses for testing
    } catch (err) {
      console.error('Error testing webhook:', err)
      error.value = err.message || 'Failed to test webhook'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Agent assignment actions

  /**
   * Get all agents for an inbox
   */
  async function getInboxAgents(inboxId) {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch(`/api/inboxes/${inboxId}/agents`)

      if (response.success) {
        return response.data
      }

      throw new Error(response.message || 'Failed to get inbox agents')
    } catch (err) {
      console.error('Error getting inbox agents:', err)
      error.value = err.message || 'Failed to get inbox agents'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Assign response agent to inbox
   */
  async function assignResponseAgent(inboxId, agentId, config = {}) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}/agents/response`, {
        method: 'PUT',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: {
          agentId,
          config
        }
      })

      if (response.success) {
        // Update the inbox in the store
        const inbox = inboxes.value.find(i => i._id === inboxId)
        if (inbox) {
          inbox.responseAgent = response.data.responseAgent
        }
        
        if (currentInbox.value?._id === inboxId) {
          currentInbox.value.responseAgent = response.data.responseAgent
        }
        
        return response.data
      }

      throw new Error(response.message || 'Failed to assign response agent')
    } catch (err) {
      console.error('Error assigning response agent:', err)
      error.value = err.message || 'Failed to assign response agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove response agent from inbox
   */
  async function removeResponseAgent(inboxId) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}/agents/response`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken
        }
      })

      if (response.success) {
        // Update the inbox in the store
        const inbox = inboxes.value.find(i => i._id === inboxId)
        if (inbox) {
          inbox.responseAgent = null
        }
        
        if (currentInbox.value?._id === inboxId) {
          currentInbox.value.responseAgent = null
        }
        
        return response.data
      }

      throw new Error(response.message || 'Failed to remove response agent')
    } catch (err) {
      console.error('Error removing response agent:', err)
      error.value = err.message || 'Failed to remove response agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Add agent to processing pipeline
   */
  async function addAgent(inboxId, agentId, priority = 100, config = {}) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}/agents`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: {
          agentId,
          priority,
          config
        }
      })

      if (response.success) {
        // Refresh inbox data to get updated agents list
        await getInbox(inboxId)
        return response.data
      }

      throw new Error(response.message || 'Failed to add agent')
    } catch (err) {
      console.error('Error adding agent:', err)
      error.value = err.message || 'Failed to add agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove agent from processing pipeline
   */
  async function removeAgent(inboxId, agentId) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken
        }
      })

      if (response.success) {
        // Refresh inbox data to get updated agents list
        await getInbox(inboxId)
        return response.data
      }

      throw new Error(response.message || 'Failed to remove agent')
    } catch (err) {
      console.error('Error removing agent:', err)
      error.value = err.message || 'Failed to remove agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update agent configuration in processing pipeline
   */
  async function updateAgent(inboxId, agentId, updateData) {
    loading.value = true
    error.value = null

    try {
      const csrfToken = await getCsrfToken()

      const response = await $fetch(`/api/inboxes/${inboxId}/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'x-csrf-token': csrfToken
        },
        body: updateData
      })

      if (response.success) {
        // Refresh inbox data to get updated agents list
        await getInbox(inboxId)
        return response.data
      }

      throw new Error(response.message || 'Failed to update agent')
    } catch (err) {
      console.error('Error updating agent:', err)
      error.value = err.message || 'Failed to update agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Utility actions

  /**
   * Set current inbox
   */
  function setCurrentInbox(inbox) {
    currentInbox.value = inbox
  }

  /**
   * Clear current inbox
   */
  function clearCurrentInbox() {
    currentInbox.value = null
  }

  /**
   * Update filters
   */
  function setFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
  }

  /**
   * Reset filters
   */
  function resetFilters() {
    filters.value = {
      accountId: null,
      channelType: null,
      isActive: 'true'
    }
  }

  /**
   * Set pagination
   */
  function setPagination(newPagination) {
    pagination.value = { ...pagination.value, ...newPagination }
  }

  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }

  /**
   * Reset store
   */
  function $reset() {
    inboxes.value = []
    currentInbox.value = null
    loading.value = false
    error.value = null
    pagination.value = {
      page: 1,
      limit: 10,
      total: 0,
      pages: 0
    }
    filters.value = {
      accountId: null,
      channelType: null,
      isActive: 'true'
    }
  }

  return {
    // State
    inboxes: readonly(inboxes),
    currentInbox: readonly(currentInbox),
    loading: readonly(loading),
    error: readonly(error),
    pagination: readonly(pagination),
    filters: readonly(filters),

    // Getters
    getInboxById,
    activeInboxes,
    inboxesByChannel,
    inboxStats,

    // Actions
    fetchInboxes,
    updateInbox,
    getInbox,
    syncWithChatwoot,
    testWebhook,
    
    // Agent actions
    getInboxAgents,
    assignResponseAgent,
    removeResponseAgent,
    addAgent,
    removeAgent,
    updateAgent,

    // Utility actions
    setCurrentInbox,
    clearCurrentInbox,
    setFilters,
    resetFilters,
    setPagination,
    clearError,
    $reset
  }
})