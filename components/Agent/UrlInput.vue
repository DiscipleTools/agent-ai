<template>
  <div class="mt-4 space-y-3">
    <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
      <input
        v-model="urlInput"
        type="url"
        placeholder="https://example.com/document"
        class="input-field flex-1 min-w-0"
        :disabled="urlTesting || urlAdding"
        @keyup.enter="addUrl"
      />
      <div class="flex space-x-2">
        <button
          type="button"
          @click="testUrl"
          :disabled="!urlInput.trim() || urlTesting || urlAdding"
          class="btn-secondary text-sm whitespace-nowrap"
        >
          <span v-if="urlTesting">Testing...</span>
          <span v-else>Test</span>
        </button>
        <button
          type="button"
          @click="addUrl"
          :disabled="!urlInput.trim() || urlTesting || urlAdding"
          class="btn-primary text-sm whitespace-nowrap"
        >
          <span v-if="urlAdding">Adding...</span>
          <span v-else>Add</span>
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="btn-secondary text-sm whitespace-nowrap"
        >
          Cancel
        </button>
      </div>
    </div>
    
    <!-- URL Test Results -->
    <div v-if="urlTestResult" class="text-left overflow-hidden">
      <div v-if="urlTestResult.success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 min-w-0 flex-1">
            <h4 class="text-sm font-medium text-green-800 dark:text-green-200">URL is accessible</h4>
            <div class="mt-1 text-sm text-green-700 dark:text-green-300">
              <p v-if="urlTestResult.data?.title" class="break-words">Title: {{ urlTestResult.data.title }}</p>
              <p>Content Type: {{ urlTestResult.data?.contentType || 'Unknown' }}</p>
              <p v-if="urlTestResult.data?.contentLength">Content Length: {{ formatContentLength(urlTestResult.data.contentLength) }}</p>
              <p v-if="urlTestResult.data?.contentPreview" class="mt-2 text-xs break-words">
                Preview: {{ urlTestResult.data.contentPreview }}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3 min-w-0 flex-1">
            <h4 class="text-sm font-medium text-red-800 dark:text-red-200">URL is not accessible</h4>
            <p class="mt-1 text-sm text-red-700 dark:text-red-300 break-words">{{ urlTestResult.data?.error || 'Unknown error' }}</p>
            <ul v-if="urlTestResult.data?.suggestions" class="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
              <li v-for="suggestion in urlTestResult.data.suggestions" :key="suggestion" class="break-words">{{ suggestion }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAgentsStore } from '~/stores/agents'
import { sanitizeUrl, sanitizeText } from '~/utils/sanitize'

const props = defineProps({
  agentId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['add-url', 'close'])

const agentsStore = useAgentsStore()

const urlInput = ref('')
const urlTesting = ref(false)
const urlAdding = ref(false)
const urlTestResult = ref(null)

// Watch for sanitization
watch(() => urlInput.value, (newValue) => {
  if (newValue && newValue !== sanitizeUrl(newValue)) {
    urlInput.value = sanitizeUrl(newValue)
  }
})

const testUrl = async () => {
  const sanitizedUrl = sanitizeUrl(urlInput.value)
  if (!sanitizedUrl || !props.agentId) return
  
  urlTesting.value = true
  urlTestResult.value = null
  
  try {
    const result = await agentsStore.testUrl(props.agentId, sanitizedUrl)
    urlTestResult.value = result
  } catch (error) {
    console.error('Frontend: URL test failed:', error.message)
    
    // Ensure consistent structure for error cases
    urlTestResult.value = {
      success: false,
      message: 'URL test failed',
      data: { 
        error: sanitizeText(error.message || 'Failed to test URL'),
        suggestions: [
          'Check if the URL is correct and publicly accessible',
          'Ensure the website allows automated access',
          'Try accessing the URL manually in a browser',
          'Check if the domain requires authentication'
        ]
      }
    }
  } finally {
    urlTesting.value = false
  }
}

const addUrl = async () => {
  const sanitizedUrl = sanitizeUrl(urlInput.value)
  if (!sanitizedUrl) return
  
  urlAdding.value = true
  
  try {
    emit('add-url', sanitizedUrl)
    urlInput.value = ''
    urlTestResult.value = null
    emit('close')
  } catch (error) {
    console.error('Failed to add URL:', error.message)
  } finally {
    urlAdding.value = false
  }
}

// Utility functions
const formatContentLength = (length) => {
  if (!length) return '0 bytes'
  if (length < 1024) return `${length} bytes`
  if (length < 1024 * 1024) return `${(length / 1024).toFixed(1)} KB`
  return `${(length / (1024 * 1024)).toFixed(1)} MB`
}
</script>

 