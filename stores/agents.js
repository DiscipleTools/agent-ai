import { defineStore } from 'pinia'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])
  const currentAgent = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const { $api } = useApi()

  const fetchAgents = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await $api('/api/agents')
      agents.value = response.data
    } catch (err) {
      console.error('Fetch agents error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to fetch agents'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const fetchAgent = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api(`/api/agents/${id}`)
      currentAgent.value = response.data
      return response.data
    } catch (err) {
      console.error('Fetch agent error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to fetch agent'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const createAgent = async (agentData) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api('/api/agents', {
        method: 'POST',
        body: agentData
      })
      
      // The response should be the agent object directly (since $fetch unwraps the response)
      agents.value.unshift(response.data)
      return response.data
    } catch (err) {
      console.error('Create agent error:', err)
      
      // Better error handling for different error types
      let errorMessage = 'Failed to create agent'
      
      if (err && typeof err === 'object') {
        // Handle FetchError from Nuxt
        if (err.data && err.data.statusMessage) {
          errorMessage = err.data.statusMessage
        } else if (err.data && err.data.message) {
          errorMessage = err.data.message
        } else if (err.statusMessage) {
          errorMessage = err.statusMessage
        } else if (err.message) {
          errorMessage = err.message
        }
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const updateAgent = async (id, agentData) => {
    loading.value = true
    error.value = null
    try {
      const response = await $api(`/api/agents/${id}`, {
        method: 'PUT',
        body: agentData
      })
      
      const index = agents.value.findIndex(agent => agent._id === id)
      if (index !== -1) {
        agents.value[index] = response.data
      }
      
      if (currentAgent.value?._id === id) {
        currentAgent.value = response.data
      }
      
      return response.data
    } catch (err) {
      console.error('Update agent error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to update agent'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  const deleteAgent = async (id) => {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/agents/${id}`, {
        method: 'DELETE'
      })
      agents.value = agents.value.filter(agent => agent._id !== id)
      
      if (currentAgent.value?._id === id) {
        currentAgent.value = null
      }
    } catch (err) {
      console.error('Delete agent error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to delete agent'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // Context Document Management Functions

  const fetchContextDocuments = async (agentId) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context`)
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to fetch context documents'
      throw err
    }
  }

  const getContextDocument = async (agentId, docId) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/${docId}`)
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to get context document'
      throw err
    }
  }

  const deleteContextDocument = async (agentId, docId) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/${docId}`, {
        method: 'DELETE'
      })
      
      // Update current agent if it's loaded
      if (currentAgent.value?._id === agentId) {
        await fetchAgent(agentId)
      }
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to delete context document'
      throw err
    }
  }

  const updateContextDocument = async (agentId, docId, updateData) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/${docId}`, {
        method: 'PUT',
        body: updateData
      })
      
      // Update current agent if it's loaded
      if (currentAgent.value?._id === agentId) {
        await fetchAgent(agentId)
      }
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to update context document'
      throw err
    }
  }

  const refreshContextDocument = async (agentId, docId) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/${docId}`, {
        method: 'PUT',
        body: { refreshUrl: true }
      })
      
      // Update current agent if it's loaded
      if (currentAgent.value?._id === agentId) {
        await fetchAgent(agentId)
      }
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to refresh context document'
      throw err
    }
  }

  const testUrl = async (agentId, url) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/test-url`, {
        method: 'POST',
        body: { url }
      })
      // The backend returns { success, message, data }, but $api might unwrap it
      // Ensure we return the structure the frontend expects
      if (response.success !== undefined) {
        return response // Already has the right structure
      } else {
        // If $api unwrapped it, wrap it back
        return {
          success: true,
          message: 'URL test successful',
          data: response
        }
      }
    } catch (err) {
      error.value = err.data?.message || 'Failed to test URL'
      throw err
    }
  }

  const uploadContext = async (agentId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await $api(`/api/agents/${agentId}/context/upload`, {
        method: 'POST',
        body: formData
      })
      
      // Update current agent if it's loaded
      if (currentAgent.value?._id === agentId) {
        await fetchAgent(agentId)
      }
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to upload context'
      throw err
    }
  }

  const addContextUrl = async (agentId, url) => {
    try {
      const response = await $api(`/api/agents/${agentId}/context/url`, {
        method: 'POST',
        body: { url }
      })
      
      // Update current agent if it's loaded
      if (currentAgent.value?._id === agentId) {
        await fetchAgent(agentId)
      }
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to add context URL'
      throw err
    }
  }

  return {
    agents: readonly(agents),
    currentAgent: readonly(currentAgent),
    loading: readonly(loading),
    error: readonly(error),
    fetchAgents,
    fetchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    // Context document management
    fetchContextDocuments,
    getContextDocument,
    deleteContextDocument,
    updateContextDocument,
    refreshContextDocument,
    testUrl,
    uploadContext,
    addContextUrl
  }
}) 