import { defineStore } from 'pinia'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])
  const currentAgent = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const fetchAgents = async () => {
    loading.value = true
    error.value = null
    try {
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch('/agents', {
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        }
      })
      agents.value = response.data
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
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch(`/agents/${id}`, {
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        }
      })
      currentAgent.value = response.data
      return response.data
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
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch('/agents', {
        method: 'POST',
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        },
        body: agentData
      })
      const newAgent = response.data
      agents.value.unshift(newAgent)
      return newAgent
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
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch(`/agents/${id}`, {
        method: 'PUT',
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        },
        body: agentData
      })
      const updatedAgent = response.data
      
      // Update in agents list
      const index = agents.value.findIndex(agent => agent._id === id)
      if (index !== -1) {
        agents.value[index] = updatedAgent
      }
      
      // Update current agent if it's the same
      if (currentAgent.value?._id === id) {
        currentAgent.value = updatedAgent
      }
      
      return updatedAgent
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
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      await $fetch(`/agents/${id}`, {
        method: 'DELETE',
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        }
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
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch(`/agents/${agentId}/context/upload`, {
        method: 'POST',
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        },
        body: formData
      })
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to upload context'
      throw err
    }
  }

  const addContextUrl = async (agentId, url) => {
    try {
      const { $fetch } = useNuxtApp()
      const accessToken = useCookie('access-token')
      
      const response = await $fetch(`/agents/${agentId}/context/url`, {
        method: 'POST',
        baseURL: useRuntimeConfig().public.apiBase,
        headers: {
          Authorization: `Bearer ${accessToken.value}`
        },
        body: { url }
      })
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
    uploadContext,
    addContextUrl
  }
}) 