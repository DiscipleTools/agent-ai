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
      const { data } = await $api('/api/agents')
      agents.value = data
    } catch (err) {
      error.value = err.data?.message || 'Failed to fetch agents'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchAgent = async (id) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/agents/${id}`)
      currentAgent.value = data
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to fetch agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createAgent = async (agentData) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/agents', {
        method: 'POST',
        body: agentData
      })
      agents.value.unshift(data)
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to create agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateAgent = async (id, agentData) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api(`/api/agents/${id}`, {
        method: 'PUT',
        body: agentData
      })
      
      // Update in agents list
      const index = agents.value.findIndex(agent => agent._id === id)
      if (index !== -1) {
        agents.value[index] = data
      }
      
      // Update current agent if it's the same
      if (currentAgent.value?._id === id) {
        currentAgent.value = data
      }
      
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to update agent'
      throw err
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
      error.value = err.data?.message || 'Failed to delete agent'
      throw err
    } finally {
      loading.value = false
    }
  }

  const uploadContext = async (agentId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const { data } = await $api(`/api/agents/${agentId}/context/upload`, {
        method: 'POST',
        body: formData
      })
      return data
    } catch (err) {
      error.value = err.data?.message || 'Failed to upload context'
      throw err
    }
  }

  const addContextUrl = async (agentId, url) => {
    try {
      const { data } = await $api(`/api/agents/${agentId}/context/url`, {
        method: 'POST',
        body: { url }
      })
      return data
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
    uploadContext,
    addContextUrl
  }
}) 