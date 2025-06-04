import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const aiConnections = ref([])

  const { $api } = useApi()

  const fetchSettings = async () => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/settings')
      settings.value = data
      aiConnections.value = data.aiConnections || []
    } catch (err) {
      console.error('Settings fetch error:', err)
      let errorMessage = 'Failed to fetch settings'
      
      if (err && typeof err === 'object') {
        if (err.data && err.data.message) {
          errorMessage = err.data.message
        } else if (err.message) {
          errorMessage = err.message
        } else if (err.statusMessage) {
          errorMessage = err.statusMessage
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

  const updateSettings = async (settingsData) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await $api('/api/settings', {
        method: 'PUT',
        body: settingsData
      })
      
      // Safely update settings
      if (response && typeof response === 'object' && response.data) {
        settings.value = response.data
        aiConnections.value = response.data.aiConnections || []
      }
      
      // Return a safe response object
      const safeResponse = {
        success: true,
        data: response?.data || null,
        message: response?.message || 'Settings updated successfully'
      }
      
      return safeResponse
    } catch (err) {
      console.error('Settings update error:', err)
      let errorMessage = 'Failed to update settings'
      
      if (err && typeof err === 'object') {
        if (err.data && err.data.message) {
          errorMessage = err.data.message
        } else if (err.message) {
          errorMessage = err.message
        } else if (err.statusMessage) {
          errorMessage = err.statusMessage
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

  // AI Connections methods
  const fetchAIConnections = async () => {
    try {
      const { data } = await $api('/api/settings/ai-connections')
      aiConnections.value = data.connections || []
      return data
    } catch (err) {
      console.error('AI connections fetch error:', err)
      throw new Error(err.data?.message || err.message || 'Failed to fetch AI connections')
    }
  }

  const createAIConnection = async (connectionData) => {
    loading.value = true
    try {
      const response = await $api('/api/settings/ai-connections', {
        method: 'POST',
        body: connectionData
      })
      
      // Refresh connections
      await fetchAIConnections()
      
      return response
    } catch (err) {
      console.error('AI connection create error:', err)
      throw new Error(err.data?.message || err.message || 'Failed to create AI connection')
    } finally {
      loading.value = false
    }
  }

  const updateAIConnection = async (connectionId, connectionData) => {
    loading.value = true
    try {
      const response = await $api(`/api/settings/ai-connections/${connectionId}`, {
        method: 'PUT',
        body: connectionData
      })
      
      // Instead of refreshing all connections, update just the specific one
      if (response && response.data) {
        const connectionIndex = aiConnections.value.findIndex(conn => conn._id === connectionId)
        if (connectionIndex !== -1) {
          // Create new array to maintain reactivity
          const newConnections = [...aiConnections.value]
          newConnections[connectionIndex] = response.data
          aiConnections.value = newConnections
        } else {
          // Fallback to full refresh if connection not found
          await fetchAIConnections()
        }
      } else {
        // Fallback to full refresh if no response data
        await fetchAIConnections()
      }
      
      return response
    } catch (err) {
      console.error('AI connection update error:', err)
      throw new Error(err.data?.message || err.message || 'Failed to update AI connection')
    } finally {
      loading.value = false
    }
  }

  const deleteAIConnection = async (connectionId) => {
    loading.value = true
    try {
      const response = await $api(`/api/settings/ai-connections/${connectionId}`, {
        method: 'DELETE'
      })
      
      // Refresh connections
      await fetchAIConnections()
      
      return response
    } catch (err) {
      console.error('AI connection delete error:', err)
      throw new Error(err.data?.message || err.message || 'Failed to delete AI connection')
    } finally {
      loading.value = false
    }
  }

  const setDefaultAI = async (connectionId, modelId) => {
    loading.value = true
    try {
      const response = await $api('/api/settings/default-ai', {
        method: 'PUT',
        body: { connectionId, modelId }
      })
      
      // Refresh settings to get updated default
      await fetchSettings()
      
      return response
    } catch (err) {
      console.error('Default AI update error:', err)
      throw new Error(err.data?.message || err.message || 'Failed to set default AI')
    } finally {
      loading.value = false
    }
  }

  // Computed properties
  const hasApiKey = computed(() => {
    return aiConnections.value?.length > 0
  })

  const isConfigured = computed(() => {
    return aiConnections.value?.some(conn => conn.isActive)
  })

  const defaultConnection = computed(() => {
    const defaultConn = settings.value?.defaultConnection
    if (defaultConn) {
      const connection = aiConnections.value?.find(conn => conn._id === defaultConn.connectionId)
      if (connection) {
        const model = connection.availableModels?.find(m => m.id === defaultConn.modelId)
        return {
          connection,
          model: model || connection.availableModels?.[0]
        }
      }
    }
    return null
  })

  return {
    settings: readonly(settings),
    loading: readonly(loading),
    error: readonly(error),
    aiConnections: readonly(aiConnections),
    hasApiKey,
    isConfigured,
    defaultConnection,
    fetchSettings,
    updateSettings,
    fetchAIConnections,
    createAIConnection,
    updateAIConnection,
    deleteAIConnection,
    setDefaultAI
  }
}) 