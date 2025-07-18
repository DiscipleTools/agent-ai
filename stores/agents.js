import { defineStore } from 'pinia'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])
  const currentAgent = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const { $api } = useApi()
  const { csrfRequest, addCsrfToForm, getCsrfToken } = useCsrf()

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
      const response = await csrfRequest('/api/agents', {
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
      const response = await csrfRequest(`/api/agents/${id}`, {
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
      await csrfRequest(`/api/agents/${id}`, {
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

  const deleteContextDocument = async (agentId, docId) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/${docId}`, {
        method: 'DELETE'
      })
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to delete context document'
      throw err
    }
  }

  const updateContextDocument = async (agentId, docId, updateData) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/${docId}`, {
        method: 'PUT',
        body: updateData
      })
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to update context document'
      throw err
    }
  }

  const refreshContextDocument = async (agentId, docId) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/${docId}`, {
        method: 'PUT',
        body: { refreshUrl: true }
      })
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to refresh context document'
      throw err
    }
  }

  const refreshContextDocumentWithProgress = async (agentId, docId, onProgress) => {
    try {
      // Get CSRF token for the request
      const token = await getCsrfToken()
      if (!token) {
        throw new Error('Could not obtain CSRF token')
      }

      // Get authentication headers including CSRF token
      const accessToken = useCookie('access-token')
      const headers = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      }
      
      if (accessToken.value) {
        headers.Authorization = `Bearer ${accessToken.value}`
      }
      
      // Use fetch with streaming for progress updates
      const response = await fetch(`/api/agents/${agentId}/context/${docId}`, {
        method: 'PUT',
        headers,
        credentials: 'include', // This will include cookies automatically
        body: JSON.stringify({ refreshUrl: true })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP error! status: ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.statusMessage || errorData.message || errorMessage
        } catch {
          // If not JSON, use the text as error message if it's short enough
          if (errorText && errorText.length < 200) {
            errorMessage = errorText
          }
        }
        
        throw new Error(errorMessage)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let finalResult = null
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process complete lines from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              break
            }
            
            if (data) {
              try {
                const parsed = JSON.parse(data)
                
                if (parsed.type === 'progress' && onProgress) {
                  onProgress(parsed)
                } else if (parsed.type === 'complete') {
                  finalResult = parsed
                  if (onProgress) {
                    onProgress(parsed)
                  }
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message || 'Re-crawling failed')
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', data, parseError)
              }
            }
          }
        }
      }
      
      return finalResult?.data || { success: true, message: 'Document refresh completed' }
    } catch (err) {
      console.error('Document refresh with progress failed:', err)
      error.value = err.message || 'Failed to refresh document with progress'
      throw err
    }
  }

  const testUrl = async (agentId, url) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/test-url`, {
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
      // Get CSRF token for the request
      const token = await getCsrfToken()
      if (!token) {
        throw new Error('Could not obtain CSRF token')
      }

      // Get authentication headers
      const accessToken = useCookie('access-token')
      const headers = {
        'X-CSRF-Token': token
      }
      
      if (accessToken.value) {
        headers.Authorization = `Bearer ${accessToken.value}`
      }
      
      // Use $api directly with proper headers for multipart form data
      const response = await $api(`/api/agents/${agentId}/context/upload`, {
        method: 'POST',
        headers,
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
      const response = await csrfRequest(`/api/agents/${agentId}/context/url`, {
        method: 'POST',
        body: { url }
      })
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to add context URL'
      throw err
    }
  }

  const testWebsite = async (agentId, url, options = {}) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/test-website`, {
        method: 'POST',
        body: { url, options }
      })
      // Ensure we return the structure the frontend expects
      if (response.success !== undefined) {
        return response // Already has the right structure
      } else {
        // If $api unwrapped it, wrap it back
        return {
          success: true,
          message: 'Website test successful',
          data: response
        }
      }
    } catch (err) {
      error.value = err.data?.message || 'Failed to test website'
      throw err
    }
  }

  const addContextWebsite = async (agentId, url, options = {}) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/context/website`, {
        method: 'POST',
        body: { url, options }
      })
      
      return response.data
    } catch (err) {
      error.value = err.data?.message || 'Failed to add website context'
      throw err
    }
  }

  const addContextWebsiteWithProgress = async (agentId, url, options = {}, onProgress) => {
    try {
      // Use fetch with streaming for POST requests (EventSource only supports GET)
      return await addContextWebsiteWithFetch(agentId, url, options, onProgress)
    } catch (err) {
      error.value = err.data?.message || 'Failed to add website context with progress'
      throw err
    }
  }

  const addContextWebsiteWithFetch = async (agentId, url, options = {}, onProgress) => {
    try {
      // Get CSRF token for the request
      const token = await getCsrfToken()
      if (!token) {
        throw new Error('Could not obtain CSRF token')
      }

      // Get authentication headers including CSRF token
      const accessToken = useCookie('access-token')
      const headers = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token
      }
      
      if (accessToken.value) {
        headers.Authorization = `Bearer ${accessToken.value}`
      }
      
      // In client-side, use browser's built-in cookie handling
      // In server-side, this won't work anyway since SSE is client-only
      const response = await fetch(`/api/agents/${agentId}/context/website`, {
        method: 'POST',
        headers,
        credentials: 'include', // This will include cookies automatically
        body: JSON.stringify({ url, options })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP error! status: ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.statusMessage || errorData.message || errorMessage
        } catch {
          // If not JSON, use the text as error message if it's short enough
          if (errorText && errorText.length < 200) {
            errorMessage = errorText
          }
        }
        
        throw new Error(errorMessage)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let finalResult = null
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process complete lines from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              break
            }
            
            if (data) {
              try {
                const parsed = JSON.parse(data)
                
                if (parsed.type === 'progress' && onProgress) {
                  onProgress(parsed)
                } else if (parsed.type === 'complete') {
                  finalResult = parsed
                  if (onProgress) {
                    onProgress(parsed)
                  }
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message || 'Crawling failed')
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', data, parseError)
              }
            }
          }
        }
      }

      return finalResult?.data || { success: true, message: 'Website crawling completed' }
    } catch (err) {
      console.error('Website crawling with progress failed:', err)
      error.value = err.message || 'Failed to add website context with progress'
      throw err
    }
  }

  // RAG Search functionality
  const searchRAG = async (agentId, query, limit = 5) => {
    try {
      const response = await csrfRequest(`/api/agents/${agentId}/rag/search`, {
        method: 'POST',
        body: { query, limit }
      })
      return response.data
    } catch (err) {
      console.error('RAG search error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to search RAG'
      error.value = errorMessage
      throw new Error(errorMessage)
    }
  }

  // AI Connection management for agents
  const fetchAIConnections = async () => {
    try {
      const response = await $api('/api/agents/ai-connections')
      return response.data
    } catch (err) {
      console.error('Fetch AI connections error:', err)
      const errorMessage = err.data?.message || err.message || 'Failed to fetch AI connections'
      error.value = errorMessage
      throw new Error(errorMessage)
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
    deleteContextDocument,
    updateContextDocument,
    refreshContextDocument,
    refreshContextDocumentWithProgress,
    testUrl,
    uploadContext,
    addContextUrl,
    testWebsite,
    addContextWebsite,
    addContextWebsiteWithProgress,
    addContextWebsiteWithFetch,
    // RAG functionality
    searchRAG,
    fetchAIConnections
  }
}) 