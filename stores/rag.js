import { defineStore } from 'pinia'

export const useRagStore = defineStore('rag', () => {
  // State
  const status = ref({
    connected: false,
    ragEnabled: false,
    lastChecked: null,
    error: null,
    checking: false
  })

  const { $api } = useApi()

  // Getters
  const isConnected = computed(() => status.value.connected)
  const isEnabled = computed(() => status.value.ragEnabled)
  const hasError = computed(() => !!status.value.error)
  const isChecking = computed(() => status.value.checking)
  
  const statusMessage = computed(() => {
    if (status.value.checking) return 'Checking RAG status...'
    if (status.value.connected) return 'RAG system online'
    if (status.value.error) return `RAG unavailable: ${status.value.error}`
    return 'RAG system offline'
  })

  const statusColor = computed(() => {
    if (status.value.checking) return 'yellow'
    if (status.value.connected) return 'green'
    return 'red'
  })

  // Actions
  const checkStatus = async () => {
    if (status.value.checking) return // Prevent multiple simultaneous checks
    
    status.value.checking = true
    status.value.error = null

    try {
      const response = await $api('/api/rag/status')
      
      if (response.success) {
        status.value.connected = response.data.qdrant.connected
        status.value.ragEnabled = response.data.ragEnabled
        status.value.lastChecked = new Date()
        
        if (!response.data.qdrant.connected) {
          status.value.error = response.data.qdrant.error || 'Connection failed'
        }
      } else {
        throw new Error('Failed to check RAG status')
      }
    } catch (error) {
      console.error('RAG status check failed:', error)
      
      // Handle authentication errors differently
      if (error.status === 401 || error.statusCode === 401) {
        // Don't treat auth errors as RAG errors - just silently fail
        status.value.connected = false
        status.value.ragEnabled = false
        status.value.error = null // Don't show auth errors as RAG errors
      } else {
        status.value.connected = false
        status.value.ragEnabled = false
        status.value.error = error.message || 'Unknown error'
      }
    } finally {
      status.value.checking = false
    }
  }

  // Auto-check status periodically
  const startStatusChecking = () => {
    // Initial check
    checkStatus()
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000)
    
    // Cleanup on unmount
    onBeforeUnmount(() => {
      clearInterval(interval)
    })
    
    return interval
  }

  const clearError = () => {
    status.value.error = null
  }

  return {
    // State
    status: readonly(status),
    
    // Getters
    isConnected,
    isEnabled,
    hasError,
    isChecking,
    statusMessage,
    statusColor,
    
    // Actions
    checkStatus,
    startStatusChecking,
    clearError
  }
}) 