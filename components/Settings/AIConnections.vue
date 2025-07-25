<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          AI Connections
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Manage your AI service connections. All connections use the OpenAI API standard.
        </p>
      </div>
      <button @click="showAddConnection = true" class="btn-primary">
        <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Connection
      </button>
    </div>

    <!-- Default Connection Display -->
    <div v-if="settingsStore.defaultConnection" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-center">
        <svg class="h-5 w-5 text-green-600 dark:text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <div>
          <h4 class="font-medium text-green-800 dark:text-green-200">Default AI Connection</h4>
          <p class="text-sm text-green-600 dark:text-green-300" v-text="`${settingsStore.defaultConnection.connection.name} - ${settingsStore.defaultConnection.model?.name || settingsStore.defaultConnection.model?.id}`">
          </p>
        </div>
      </div>
    </div>

    <!-- AI Connections List -->
    <div v-if="settingsStore.aiConnections?.length" class="space-y-4">
      <div v-for="connection in settingsStore.aiConnections" :key="connection._id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative">
        <!-- Loading overlay -->
        <div v-if="updatingConnections.has(connection._id)" class="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div class="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span class="text-sm">Updating...</span>
          </div>
        </div>
        
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center">
            <div :class="[
              'h-3 w-3 rounded-full mr-3',
              connection.isActive ? 'bg-green-500' : 'bg-gray-400'
            ]"></div>
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white" v-text="connection.name || 'Loading...'"></h4>
              <p class="text-sm text-gray-500 dark:text-gray-400" v-text="connection.endpoint || 'Loading...'"></p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button 
              v-if="connection.availableModels?.length"
              @click="toggleConnectionModels(connection._id)" 
              class="btn-secondary text-sm flex items-center"
              title="Show/hide models for this connection"
            >
              <svg class="h-4 w-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <span>{{ expandedConnections.has(connection._id) ? 'Hide Models' : 'Manage Models' }}</span>
            </button>
            <button @click="editConnection(connection)" class="btn-secondary text-sm">
              Edit
            </button>
            <button @click="deleteConnection(connection)" class="btn-danger text-sm">
              Delete
            </button>
          </div>
        </div>
        
        <!-- Models List -->
        <div v-if="connection.availableModels?.length" class="mt-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Available Models:</p>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ connection.availableModels.filter(m => m.enabled).length }} / {{ connection.availableModels.length }} enabled
            </span>
          </div>
          
          <!-- Collapsed view - clickable model badges -->
          <div v-if="!expandedConnections.has(connection._id)" class="flex flex-wrap gap-2">
            <button 
              v-for="(model, index) in connection.availableModels" 
              :key="model.id" 
              @click="toggleModelEnabledInMain(connection, index)"
              :disabled="updatingConnections.has(connection._id)"
              :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors duration-200 hover:opacity-80',
                model.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                updatingConnections.has(connection._id) ? 'opacity-50 cursor-not-allowed' : ''
              ]"
              :title="`Click to ${model.enabled ? 'disable' : 'enable'} ${model.name || model.id}`"
            >
              <span>{{ model.name || model.id }}</span>
              <button 
                v-if="!isDefaultModel(connection._id, model.id)"
                @click.stop="setAsDefault(connection._id, model.id)" 
                class="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Set as default"
                :disabled="updatingConnections.has(connection._id)"
              >
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <span v-else class="ml-1 text-yellow-500" title="Default model">
                <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </span>
            </button>
          </div>
          
          <!-- Expanded view - model management -->
          <div v-else class="space-y-2">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Click to enable/disable models for use by agents. At least one model must be enabled.
              </p>
              <div class="flex items-center space-x-2">
                <button
                  @click="refreshConnectionModels(connection)"
                  :disabled="updatingConnections.has(connection._id)"
                  class="text-xs btn-secondary flex items-center"
                  title="Refresh model list from API"
                >
                  <svg v-if="!updatingConnections.has(connection._id)" class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <div v-else class="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1 flex-shrink-0"></div>
                  <span>Refresh</span>
                </button>
                <button
                  @click="disableAllModels(connection)"
                  :disabled="updatingConnections.has(connection._id) || connection.availableModels.every(m => !m.enabled)"
                  class="text-xs btn-secondary flex items-center"
                  title="Disable all models"
                >
                  <svg class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                  </svg>
                  <span>Disable All</span>
                </button>
                <button
                  @click="enableAllModels(connection)"
                  :disabled="updatingConnections.has(connection._id) || connection.availableModels.every(m => m.enabled)"
                  class="text-xs btn-secondary flex items-center"
                  title="Enable all models"
                >
                  <svg class="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Enable All</span>
                </button>
              </div>
            </div>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <div 
                v-for="(model, index) in connection.availableModels" 
                :key="model.id"
                class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div class="flex items-center flex-1">
                  <input
                    :id="`main-model-${connection._id}-${index}`"
                    type="checkbox"
                    :checked="model.enabled"
                    @change="toggleModelEnabledInMain(connection, index)"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label 
                    :for="`main-model-${connection._id}-${index}`"
                    class="ml-2 text-sm text-gray-900 dark:text-white font-medium cursor-pointer"
                  >
                    {{ model.name || model.id }}
                  </label>
                </div>
                <div class="flex items-center space-x-2">
                  <button 
                    v-if="!isDefaultModel(connection._id, model.id) && model.enabled"
                    @click="setAsDefault(connection._id, model.id)" 
                    class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                    title="Set as default"
                  >
                    Set Default
                  </button>
                  <span 
                    v-if="isDefaultModel(connection._id, model.id)"
                    class="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded-full"
                  >
                    Default
                  </span>
                </div>
              </div>
            </div>
            <p v-if="connection.availableModels.every(m => !m.enabled)" class="text-xs text-red-500 dark:text-red-400 mt-2">
              ⚠️ At least one model must be enabled for this connection to be usable.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- No Connections State -->
    <div v-else class="text-center py-8">
      <div class="text-gray-400 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No AI connections configured
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Add your first AI connection to get started with Agent AI.
      </p>
      <button @click="showAddConnection = true" class="btn-primary">
        Add AI Connection
      </button>
    </div>

    <!-- Add/Edit AI Connection Modal -->
    <div v-if="showAddConnection || editingConnection" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" @click="closeConnectionModal">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {{ editingConnection ? 'Edit' : 'Add' }} AI Connection
            </h3>
            
            <form @submit.prevent class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Connection Name *
                </label>
                <input
                  v-model="connectionForm.name"
                  type="text"
                  class="input-field"
                  placeholder="e.g., OpenAI GPT-4, Anthropic Claude"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select v-model="connectionForm.provider" class="input-field">
                  <option value="openai">OpenAI</option>
                  <option value="prediction-guard">Prediction Guard</option>
                  <option value="custom">Custom OpenAI Compatible</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Endpoint *
                </label>
                <input
                  v-model="connectionForm.endpoint"
                  type="url"
                  class="input-field"
                  :placeholder="getEndpointPlaceholder()"
                  required
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The base URL for the API (e.g., https://api.openai.com/v1)
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key *
                </label>
                <div class="relative">
                  <input
                    v-model="connectionForm.apiKey"
                    :type="showConnectionApiKey ? 'text' : 'password'"
                    class="input-field pr-10"
                    :placeholder="editingConnection ? 'Leave empty to keep current API key' : 'Enter your API key'"
                    :required="!editingConnection"
                  />
                  <button
                    type="button"
                    @click="showConnectionApiKey = !showConnectionApiKey"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg v-if="showConnectionApiKey" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                    <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div class="flex items-center">
                <input
                  v-model="connectionForm.isActive"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Active (enable this connection for use)
                </label>
              </div>
            </form>
          </div>
          
          <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              @click="saveConnection"
              :disabled="settingsStore.loading || !isConnectionFormValid || submittingConnection"
              class="btn-primary w-full sm:ml-3 sm:w-auto"
            >
              <span v-if="settingsStore.loading || submittingConnection" class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {{ editingConnection ? 'Updating...' : 'Creating...' }}
              </span>
              <span v-else>
                {{ editingConnection ? 'Update' : 'Create' }} Connection
              </span>
            </button>
            <button
              @click="closeConnectionModal"
              :disabled="settingsStore.loading"
              class="btn-secondary w-full mt-3 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeUrl } from '~/utils/sanitize'

const settingsStore = useSettingsStore()
const toast = useToast()

// AI Connection state
const showAddConnection = ref(false)
const editingConnection = ref(null)
const showConnectionApiKey = ref(false)
const expandedConnections = ref(new Set())
const updatingConnections = ref(new Set())
const submittingConnection = ref(false)

// AI Connection form data
const connectionForm = reactive({
  name: '',
  provider: 'custom',
  endpoint: '',
  apiKey: '',
  isActive: true
})

// Real-time input sanitization watchers
watch(() => connectionForm.name, (newValue) => {
  const sanitized = sanitizeText(newValue)
  if (newValue !== sanitized) {
    connectionForm.name = sanitized
  }
})

watch(() => connectionForm.endpoint, (newValue) => {
  const sanitized = sanitizeUrl(newValue)
  if (newValue !== sanitized) {
    connectionForm.endpoint = sanitized
  }
})

// Utility functions
const logSafeData = (data, label = 'Data') => {
  const safeData = { ...data }
  if (safeData.apiKey) safeData.apiKey = '***MASKED***'
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

// Validation
const validateConnectionForm = () => {
  const errors = {}
  
  if (!connectionForm.name.trim() || connectionForm.name.trim().length < 2) {
    errors.name = 'Connection name must be at least 2 characters'
  }
  
  if (!connectionForm.endpoint.trim()) {
    errors.endpoint = 'API endpoint is required'
  } else {
    try {
      const url = new URL(connectionForm.endpoint)
      if (!['https:', 'http:'].includes(url.protocol)) {
        errors.endpoint = 'Only HTTP and HTTPS protocols are allowed'
      }
    } catch {
      errors.endpoint = 'Please enter a valid URL'
    }
  }
  
  if (!editingConnection.value && !connectionForm.apiKey.trim()) {
    errors.apiKey = 'API key is required for new connections'
  }
  
  return Object.keys(errors).length === 0 ? null : errors
}

const isConnectionFormValid = computed(() => {
  return validateConnectionForm() === null
})

// Rate limiting
const rateLimiters = {
  modelRefresh: { lastCall: 0, minInterval: 3000 }
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

// AI Connection methods
const getEndpointPlaceholder = () => {
  switch (connectionForm.provider) {
    case 'openai':
      return 'https://api.openai.com/v1'
    case 'prediction-guard':
      return 'https://api.predictionguard.com'
    default:
      return 'https://your-api-provider.com/v1'
  }
}

const editConnection = (connection) => {
  editingConnection.value = connection
  connectionForm.name = connection.name
  connectionForm.provider = connection.provider || 'custom'
  connectionForm.endpoint = connection.endpoint
  connectionForm.apiKey = ''
  connectionForm.isActive = connection.isActive
  showAddConnection.value = true
}

const closeConnectionModal = () => {
  showAddConnection.value = false
  editingConnection.value = null
  showConnectionApiKey.value = false
  
  // Reset form
  connectionForm.name = ''
  connectionForm.provider = 'custom'
  connectionForm.endpoint = ''
  connectionForm.apiKey = ''
  connectionForm.isActive = true
}

const saveConnection = async () => {
  if (submittingConnection.value) return

  const validationErrors = validateConnectionForm()
  if (validationErrors) {
    const firstError = Object.values(validationErrors)[0]
    toast(firstError, { type: 'error' })
    return
  }

  submittingConnection.value = true

  try {
    const connectionData = {
      name: sanitizeText(connectionForm.name),
      provider: sanitizeText(connectionForm.provider),
      endpoint: sanitizeUrl(connectionForm.endpoint),
      isActive: connectionForm.isActive
    }
    
    if (connectionForm.apiKey.trim()) {
      connectionData.apiKey = connectionForm.apiKey
    }

    if (editingConnection.value) {
      await settingsStore.updateAIConnection(editingConnection.value._id, connectionData)
      toast('AI connection updated successfully!', { type: 'success' })
    } else {
      await settingsStore.createAIConnection(connectionData)
      toast('AI connection created successfully!', { type: 'success' })
    }
    
    closeConnectionModal()
  } catch (error) {
    logSafeData(error, 'AI connection save error')
    toast(sanitizeErrorMessage(error), { type: 'error' })
  } finally {
    submittingConnection.value = false
  }
}

const deleteConnection = async (connection) => {
  if (!confirm(`Are you sure you want to delete the connection "${connection.name}"?`)) {
    return
  }

  try {
    await settingsStore.deleteAIConnection(connection._id)
    toast('AI connection deleted successfully!', { type: 'success' })
  } catch (error) {
    logSafeData(error, 'AI connection delete error')
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const isDefaultModel = (connectionId, modelId) => {
  const defaultConn = settingsStore.defaultConnection
  return defaultConn?.connection._id === connectionId && defaultConn?.model?.id === modelId
}

const setAsDefault = async (connectionId, modelId) => {
  try {
    await settingsStore.setDefaultAI(connectionId, modelId)
    toast('Default AI connection updated!', { type: 'success' })
  } catch (error) {
    logSafeData(error, 'Set default AI error')
    toast(sanitizeErrorMessage(error), { type: 'error' })
  }
}

const toggleConnectionModels = (connectionId) => {
  if (expandedConnections.value.has(connectionId)) {
    expandedConnections.value.delete(connectionId)
  } else {
    expandedConnections.value.add(connectionId)
  }
}

const toggleModelEnabledInMain = async (connection, modelIndex) => {
  try {
    updatingConnections.value.add(connection._id)
    const wasExpanded = expandedConnections.value.has(connection._id)
    
    const updatedModels = [...connection.availableModels]
    updatedModels[modelIndex].enabled = !updatedModels[modelIndex].enabled
    
    await settingsStore.updateAIConnection(connection._id, {
      availableModels: updatedModels
    })
    
    if (wasExpanded) {
      expandedConnections.value.add(connection._id)
    }
    
  } catch (error) {
    logSafeData(error, 'Toggle model error')
    toast(sanitizeErrorMessage(error), { type: 'error' })
  } finally {
    updatingConnections.value.delete(connection._id)
  }
}

const refreshConnectionModels = async (connection) => {
  if (!connection?._id) {
    toast('Cannot refresh models: Invalid connection ID.', { type: 'error' })
    return
  }
  try {
    checkRateLimit('modelRefresh')
  } catch (error) {
    toast(error.message, { type: 'warning' })
    return
  }

  try {
    updatingConnections.value.add(connection._id)
    const wasExpanded = expandedConnections.value.has(connection._id)
    
    await settingsStore.refreshConnectionModels(connection._id)
    
    if (wasExpanded) {
      expandedConnections.value.add(connection._id)
    }
    
    toast('Models refreshed successfully!', { type: 'success' })
    
  } catch (error) {
    logSafeData(error, 'Refresh models error')
    toast(sanitizeErrorMessage(error) || 'Failed to refresh models', { type: 'error' })
  } finally {
    updatingConnections.value.delete(connection._id)
  }
}

const disableAllModels = async (connection) => {
  try {
    updatingConnections.value.add(connection._id)
    const wasExpanded = expandedConnections.value.has(connection._id)
    
    const updatedModels = connection.availableModels.map(model => ({
      ...model,
      enabled: false
    }))
    
    await settingsStore.updateAIConnection(connection._id, {
      availableModels: updatedModels
    })
    
    if (wasExpanded) {
      expandedConnections.value.add(connection._id)
    }
    
    toast('All models disabled', { type: 'success' })
    
  } catch (error) {
    logSafeData(error, 'Disable all models error')
    toast(sanitizeErrorMessage(error) || 'Failed to disable all models', { type: 'error' })
  } finally {
    updatingConnections.value.delete(connection._id)
  }
}

const enableAllModels = async (connection) => {
  try {
    updatingConnections.value.add(connection._id)
    const wasExpanded = expandedConnections.value.has(connection._id)
    
    const updatedModels = connection.availableModels.map(model => ({
      ...model,
      enabled: true
    }))
    
    await settingsStore.updateAIConnection(connection._id, {
      availableModels: updatedModels
    })
    
    if (wasExpanded) {
      expandedConnections.value.add(connection._id)
    }
    
    toast('All models enabled', { type: 'success' })
    
  } catch (error) {
    logSafeData(error, 'Enable all models error')
    toast(sanitizeErrorMessage(error) || 'Failed to enable all models', { type: 'error' })
  } finally {
    updatingConnections.value.delete(connection._id)
  }
}
</script>