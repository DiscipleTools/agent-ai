<template>
  <form @submit.prevent="handleSubmit" class="space-y-8">
    <!-- Basic Information -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
      
      <div class="grid grid-cols-1 gap-6">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            class="input-field"
            :class="{ 'border-red-500': errors.name }"
            placeholder="Enter agent name"
          />
          <div class="flex justify-between mt-1">
            <p v-if="errors.name" class="text-sm text-red-600">{{ errors.name }}</p>
            <p class="text-xs text-gray-500">{{ form.name.length }}/100 characters</p>
          </div>
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            v-model="form.description"
            rows="3"
            class="input-field"
            :class="{ 'border-red-500': errors.description }"
            placeholder="Brief description of the agent's purpose"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="errors.description" class="text-sm text-red-600">{{ errors.description }}</p>
            <p class="text-xs text-gray-500">{{ (form.description || '').length }}/500 characters</p>
          </div>
        </div>

        <div>
          <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Prompt *
          </label>
          <textarea
            id="prompt"
            v-model="form.prompt"
            rows="6"
            required
            class="input-field"
            :class="{ 'border-red-500': errors.prompt }"
            placeholder="Define the agent's behavior, personality, and instructions..."
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="errors.prompt" class="text-sm text-red-600">{{ errors.prompt }}</p>
            <p class="text-xs text-gray-500">{{ form.prompt.length }}/2000 characters</p>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Settings -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">AI Settings</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label for="temperature" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Temperature
          </label>
          <input
            id="temperature"
            v-model.number="form.settings.temperature"
            type="number"
            step="0.1"
            min="0"
            max="1"
            class="input-field"
          />
          <p class="text-xs text-gray-500 mt-1">Controls randomness (0 = focused, 1 = creative)</p>
        </div>
        
        <div>
          <label for="maxTokens" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max Tokens
          </label>
          <input
            id="maxTokens"
            v-model.number="form.settings.maxTokens"
            type="number"
            min="1"
            max="2000"
            class="input-field"
          />
          <p class="text-xs text-gray-500 mt-1">Maximum response length</p>
        </div>
        
        <div>
          <label for="responseDelay" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Response Delay (seconds)
          </label>
          <input
            id="responseDelay"
            v-model.number="form.settings.responseDelay"
            type="number"
            min="0"
            max="30"
            class="input-field"
          />
          <p class="text-xs text-gray-500 mt-1">Delay before sending response</p>
        </div>
      </div>
    </div>

    <!-- Context Documents (if editing) -->
    <div v-if="agent && agent._id" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Context Documents</h2>
      
      <!-- Existing Documents -->
      <div v-if="contextDocuments && contextDocuments.length > 0" class="space-y-3 mb-6">
        <div
          v-for="doc in contextDocuments"
          :key="doc._id"
          class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div class="flex items-center space-x-3 flex-1">
            <div class="flex-shrink-0">
              <DocumentIcon v-if="doc.type === 'file'" class="h-5 w-5 text-gray-400" />
              <LinkIcon v-else class="h-5 w-5 text-gray-400" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ doc.filename || doc.url }}
              </p>
              <p class="text-xs text-gray-500">
                {{ doc.type === 'file' ? 'File' : 'URL' }} • 
                {{ formatDate(doc.uploadedAt) }} • 
                {{ formatContentLength(doc.contentLength) }}
              </p>
              <p v-if="doc.contentPreview" class="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                {{ doc.contentPreview }}
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button
              type="button"
              @click="viewContextDocument(doc._id)"
              class="text-blue-600 hover:text-blue-700 text-sm"
              title="View content"
            >
              View
            </button>
            <button
              v-if="doc.type === 'url'"
              type="button"
              @click="refreshContextDocument(doc._id)"
              :disabled="refreshingDocs.has(doc._id)"
              class="text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
              title="Refresh URL content"
            >
              <span v-if="refreshingDocs.has(doc._id)">Refreshing...</span>
              <span v-else>Refresh</span>
            </button>
            <button
              type="button"
              @click="removeContextDocument(doc._id)"
              :disabled="deletingDocs.has(doc._id)"
              class="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
              title="Remove document"
            >
              <span v-if="deletingDocs.has(doc._id)">Removing...</span>
              <span v-else>Remove</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Add New Context -->
      <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div class="text-center">
          <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
          <div class="mt-4">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">
              Add Context Documents
            </h3>
            <p class="text-sm text-gray-500 mt-1">
              Upload files or add URLs to provide additional context for your agent
            </p>
          </div>
          
          <div class="mt-4 flex justify-center space-x-4">
            <button
              type="button"
              @click="$refs.fileInput?.click()"
              class="btn-secondary text-sm"
            >
              Choose File
            </button>
            <button
              type="button"
              @click="showUrlInput = !showUrlInput"
              class="btn-secondary text-sm"
            >
              Add URL
            </button>
          </div>
          
          <!-- URL Input -->
          <div v-if="showUrlInput" class="mt-4 space-y-3">
            <div class="flex space-x-2">
              <input
                v-model="urlInput"
                type="url"
                placeholder="https://example.com/document"
                class="input-field flex-1"
                :disabled="urlTesting || urlAdding"
                @keyup.enter="addContextUrl"
              />
              <button
                type="button"
                @click="testUrlBeforeAdd"
                :disabled="!urlInput.trim() || urlTesting || urlAdding"
                class="btn-secondary text-sm"
              >
                <span v-if="urlTesting">Testing...</span>
                <span v-else>Test</span>
              </button>
              <button
                type="button"
                @click="addContextUrl"
                :disabled="!urlInput.trim() || urlTesting || urlAdding"
                class="btn-primary text-sm"
              >
                <span v-if="urlAdding">Adding...</span>
                <span v-else>Add</span>
              </button>
            </div>
            
            <!-- URL Test Results -->
            <div v-if="urlTestResult" class="text-left">
              <div v-if="urlTestResult.success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h4 class="text-sm font-medium text-green-800 dark:text-green-200">URL is accessible</h4>
                    <div class="mt-1 text-sm text-green-700 dark:text-green-300">
                      <p v-if="urlTestResult.data?.title">Title: {{ urlTestResult.data.title }}</p>
                      <p>Content Type: {{ urlTestResult.data?.contentType || 'Unknown' }}</p>
                      <p v-if="urlTestResult.data?.contentLength">Content Length: {{ formatContentLength(urlTestResult.data.contentLength) }}</p>
                      <p v-if="urlTestResult.data?.contentPreview" class="mt-2 text-xs">
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
                  <div class="ml-3">
                    <h4 class="text-sm font-medium text-red-800 dark:text-red-200">URL is not accessible</h4>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ urlTestResult.data?.error || 'Unknown error' }}</p>
                    <ul v-if="urlTestResult.data?.suggestions" class="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                      <li v-for="suggestion in urlTestResult.data.suggestions" :key="suggestion">{{ suggestion }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Hidden file input -->
          <input
            ref="fileInput"
            type="file"
            class="sr-only"
            @change="handleFileUpload"
            accept=".pdf,.txt,.doc,.docx"
          />
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end space-x-4">
      <button
        type="button"
        @click="$emit('cancel')"
        class="btn-secondary"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="btn-primary"
      >
        <span v-if="isSubmitting" class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          {{ agent && agent._id ? 'Updating...' : 'Creating...' }}
        </span>
        <span v-else>{{ agent && agent._id ? 'Update Agent' : 'Create Agent' }}</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import { DocumentIcon, LinkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  agent: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['submit', 'cancel'])

// Stores
const agentsStore = useAgentsStore()
const toast = useToast()

// Form state
const form = reactive({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  prompt: props.agent?.prompt || '',
  settings: {
    temperature: props.agent?.settings?.temperature || 0.7,
    maxTokens: props.agent?.settings?.maxTokens || 500,
    responseDelay: props.agent?.settings?.responseDelay || 0
  }
})

const errors = reactive({})
const isSubmitting = ref(false)
const showUrlInput = ref(false)
const urlInput = ref('')
const urlTesting = ref(false)
const urlAdding = ref(false)
const urlTestResult = ref(null)

// Context documents state
const contextDocuments = ref([])
const refreshingDocs = ref(new Set())
const deletingDocs = ref(new Set())

// Load context documents function (defined before watcher)
const loadContextDocuments = async () => {
  if (!props.agent?._id) return
  
  try {
    const response = await agentsStore.fetchContextDocuments(props.agent._id)
    contextDocuments.value = response.contextDocuments || []
  } catch (error) {
    console.error('Failed to load context documents:', error)
    toast.error('Failed to load context documents')
  }
}

// Watch for prop changes (when editing)
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = newAgent.name || ''
    form.description = newAgent.description || ''
    form.prompt = newAgent.prompt || ''
    form.settings = {
      temperature: newAgent.settings?.temperature || 0.7,
      maxTokens: newAgent.settings?.maxTokens || 500,
      responseDelay: newAgent.settings?.responseDelay || 0
    }
    
    // Load context documents if editing
    if (newAgent._id) {
      loadContextDocuments()
    }
  }
}, { immediate: true })

// Validation
const validateForm = () => {
  const newErrors = {}

  if (!form.name?.trim()) {
    newErrors.name = 'Agent name is required'
  } else if (form.name.length > 100) {
    newErrors.name = 'Agent name cannot exceed 100 characters'
  }

  if (!form.prompt?.trim()) {
    newErrors.prompt = 'System prompt is required'
  } else if (form.prompt.length < 10) {
    newErrors.prompt = 'Prompt must be at least 10 characters long'
  } else if (form.prompt.length > 2000) {
    newErrors.prompt = 'Prompt cannot exceed 2000 characters'
  }

  if (form.description && form.description.length > 500) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  // Clear previous errors and set new ones
  Object.keys(errors).forEach(key => delete errors[key])
  Object.assign(errors, newErrors)

  return Object.keys(newErrors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    const agentData = {
      name: form.name.trim(),
      description: form.description?.trim() || '',
      prompt: form.prompt.trim(),
      settings: {
        temperature: Number(form.settings.temperature),
        maxTokens: Number(form.settings.maxTokens),
        responseDelay: Number(form.settings.responseDelay)
      }
    }

    emit('submit', agentData)
  } finally {
    isSubmitting.value = false
  }
}

// Context document management
const testUrlBeforeAdd = async () => {
  if (!urlInput.value.trim() || !props.agent?._id) return
  
  urlTesting.value = true
  urlTestResult.value = null
  
  try {
    const result = await agentsStore.testUrl(props.agent._id, urlInput.value.trim())
    urlTestResult.value = result
  } catch (error) {
    console.error('Frontend: URL test failed with error:', error)
    console.error('Frontend: Error details:', {
      message: error.message,
      data: error.data,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      stack: error.stack
    })
    
    // Ensure consistent structure for error cases
    urlTestResult.value = {
      success: false,
      message: 'URL test failed',
      data: { 
        error: error.message || 'Failed to test URL',
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

const addContextUrl = async () => {
  if (!urlInput.value.trim() || !props.agent?._id) return
  
  urlAdding.value = true
  
  try {
    await agentsStore.addContextUrl(props.agent._id, urlInput.value.trim())
    toast.success('URL content added successfully')
    urlInput.value = ''
    showUrlInput.value = false
    urlTestResult.value = null
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to add URL:', error)
    toast.error(error.message || 'Failed to add URL content')
  } finally {
    urlAdding.value = false
  }
}

const removeContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  deletingDocs.value.add(docId)
  
  try {
    await agentsStore.deleteContextDocument(props.agent._id, docId)
    toast.success('Context document removed successfully')
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to remove document:', error)
    toast.error(error.message || 'Failed to remove context document')
  } finally {
    deletingDocs.value.delete(docId)
  }
}

const refreshContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  refreshingDocs.value.add(docId)
  
  try {
    await agentsStore.refreshContextDocument(props.agent._id, docId)
    toast.success('Context document refreshed successfully')
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to refresh document:', error)
    toast.error(error.message || 'Failed to refresh context document')
  } finally {
    refreshingDocs.value.delete(docId)
  }
}

const viewContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  try {
    const response = await agentsStore.getContextDocument(props.agent._id, docId)
    // TODO: Open modal or navigate to view page
    toast.info('Document viewing not yet implemented')
  } catch (error) {
    console.error('Failed to get document:', error)
    toast.error(error.message || 'Failed to get context document')
  }
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    // TODO: Implement file upload
    console.log('File selected:', file)
    toast.info('File upload not yet implemented')
  }
}

// Utility functions
const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatContentLength = (length) => {
  if (!length) return '0 bytes'
  if (length < 1024) return `${length} bytes`
  if (length < 1024 * 1024) return `${(length / 1024).toFixed(1)} KB`
  return `${(length / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.input-field {
  @apply block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white;
}

.btn-primary {
  @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600;
}
</style> 