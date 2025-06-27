<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          RAG System Status
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Monitor the health of the Retrieval-Augmented Generation system
        </p>
      </div>
      <button
        @click="checkRAGHealth"
        :disabled="checkingRAGHealth"
        class="btn-secondary text-sm flex items-center"
      >
        <svg v-if="!checkingRAGHealth" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
        <span>{{ checkingRAGHealth ? 'Checking...' : 'Refresh Status' }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="ragHealthLoading && !ragHealthStatus" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>

    <!-- Health Status Display -->
    <div v-else class="space-y-4">
      <!-- Overall Status -->
      <div class="flex items-center p-3 rounded-lg" :class="[
        ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      ]">
        <div class="flex items-center">
          <svg v-if="ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded" 
               class="h-5 w-5 text-green-600 dark:text-green-400 mr-3" 
               fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <svg v-else class="h-5 w-5 text-red-600 dark:text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div>
            <h4 class="font-medium" :class="[
              ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded 
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            ]">
              {{ ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded 
                  ? 'RAG System Operational' 
                  : 'RAG System Issues Detected' }}
            </h4>
            <p class="text-sm" :class="[
              ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded 
                ? 'text-green-600 dark:text-green-300'
                : 'text-red-600 dark:text-red-300'
            ]">
              {{ ragHealthStatus?.data?.qdrant?.connected && ragHealthStatus?.data?.embeddings?.modelLoaded 
                  ? 'All components are functioning correctly'
                  : 'One or more components require attention' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Component Status Details -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Qdrant Database -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h5 class="font-medium text-gray-900 dark:text-white">Qdrant Vector Database</h5>
            <div class="flex items-center">
              <div :class="[
                'h-2 w-2 rounded-full mr-2',
                ragHealthStatus?.data?.qdrant?.connected ? 'bg-green-500' : 'bg-red-500'
              ]"></div>
              <span class="text-xs" :class="[
                ragHealthStatus?.data?.qdrant?.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              ]">
                {{ ragHealthStatus?.data?.qdrant?.connected ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            URL: {{ ragHealthStatus?.data?.qdrant?.url || 'Unknown' }}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-300">
            {{ ragHealthStatus?.data?.qdrant?.connected 
                ? 'Vector database is accessible and responding' 
                : 'Cannot connect to vector database' }}
          </p>
        </div>

        <!-- Embedding Model -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h5 class="font-medium text-gray-900 dark:text-white">Embedding Model</h5>
            <div class="flex items-center">
              <div :class="[
                'h-2 w-2 rounded-full mr-2',
                ragHealthStatus?.data?.embeddings?.modelLoaded ? 'bg-green-500' : 'bg-red-500'
              ]"></div>
              <span class="text-xs" :class="[
                ragHealthStatus?.data?.embeddings?.modelLoaded ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              ]">
                {{ ragHealthStatus?.data?.embeddings?.modelLoaded ? 'Loaded' : 'Not Loaded' }}
              </span>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Model: {{ ragHealthStatus?.data?.embeddings?.modelName || 'Unknown' }}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-300">
            {{ ragHealthStatus?.data?.embeddings?.modelLoaded 
                ? 'Text embedding model is ready for use' 
                : 'Embedding model failed to load' }}
          </p>
        </div>
      </div>

      <!-- Error Information -->
      <div v-if="ragHealthStatus?.data?.error || ragHealthError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div class="flex items-start">
          <svg class="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div>
            <h6 class="font-medium text-red-800 dark:text-red-200">Error Details</h6>
            <p class="text-sm text-red-600 dark:text-red-300 mt-1">
              {{ ragHealthError || ragHealthStatus?.data?.error }}
            </p>
          </div>
        </div>
      </div>

      <!-- Last Check Information -->
      <div v-if="ragHealthStatus?.data?.timestamp" class="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        Last checked: {{ formatDate(ragHealthStatus.data.timestamp) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useToast } from 'vue-toastification'
import { sanitizeText } from '~/utils/sanitize'

const { $api } = useApi()
const toast = useToast()

// RAG health status
const ragHealthStatus = ref(null)
const ragHealthError = ref(null)
const ragHealthLoading = ref(false)
const checkingRAGHealth = ref(false)

// Rate limiting
const rateLimiters = {
  ragHealth: { lastCall: 0, minInterval: 5000 }
}

const checkRateLimit = (operation) => {
  const now = Date.now()
  const limiter = rateLimiters[operation]
  
  if (now - limiter.lastCall < limiter.minInterval) {
    const waitTime = Math.ceil((limiter.minInterval - (now - limiter.lastCall)) / 1000)
    throw new Error(`Please wait ${waitTime} seconds before trying again`)
  }
  
  limiter.lastCall = now
  return true
}

// Utility functions
const logSafeData = (data, label = 'Data') => {
  const safeData = { ...data }
  console.log(label + ':', safeData)
  return safeData
}

const sanitizeErrorMessage = (error) => {
  if (!error) return 'Unknown error occurred'
  
  let message = 'Operation failed'
  if (typeof error === 'string') {
    message = sanitizeText(error)
  } else if (error.message) {
    message = sanitizeText(error.message)
  } else if (error.data?.message) {
    message = sanitizeText(error.data.message)
  } else if (error.statusMessage) {
    message = sanitizeText(error.statusMessage)
  }
  
  return message
    .replace(/password/gi, 'credentials')
    .replace(/token/gi, 'authentication')
    .replace(/key/gi, 'authentication')
    .substring(0, 200)
}

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// RAG health check methods
const checkRAGHealth = async () => {
  try {
    checkRateLimit('ragHealth')
  } catch (error) {
    toast(error.message, { type: 'warning' })
    return
  }

  checkingRAGHealth.value = true
  ragHealthError.value = null

  try {
    const response = await $api('/api/rag/health', {
      method: 'GET'
    })
    
    ragHealthStatus.value = response
    console.log('RAG health check result:', response)
    
  } catch (error) {
    logSafeData(error, 'RAG health check error')
    
    const errorMessage = sanitizeErrorMessage(error) || 'Failed to check RAG health status'
    ragHealthError.value = errorMessage
    toast(errorMessage, { type: 'error' })
  } finally {
    checkingRAGHealth.value = false
  }
}

// Initialize RAG health check on mount
onMounted(() => {
  ragHealthLoading.value = true
  checkRAGHealth().finally(() => {
    ragHealthLoading.value = false
  })
})
</script> 