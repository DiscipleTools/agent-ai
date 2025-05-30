import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const { $api } = useApi()

  const fetchSettings = async () => {
    loading.value = true
    error.value = null
    try {
      const { data } = await $api('/api/settings')
      settings.value = data
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

  const hasApiKey = computed(() => {
    return settings.value?.predictionGuard?.apiKey === '***HIDDEN***'
  })

  const isConfigured = computed(() => {
    return hasApiKey.value && settings.value?.predictionGuard?.endpoint
  })

  return {
    settings: readonly(settings),
    loading: readonly(loading),
    error: readonly(error),
    hasApiKey,
    isConfigured,
    fetchSettings,
    updateSettings
  }
}) 