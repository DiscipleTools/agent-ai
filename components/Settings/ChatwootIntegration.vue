<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Chatwoot Integration
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Configure global Chatwoot settings for webhook integrations.
        </p>
      </div>
      <div v-if="isChatwootConfigured" class="flex items-center text-green-600 dark:text-green-400">
        <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <span class="text-sm font-medium">Configured</span>
      </div>
    </div>

    <div class="space-y-6">
      <!-- Enable Chatwoot Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Chatwoot Integration
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Turn on Chatwoot integration for webhook processing
          </p>
        </div>
        <button
          type="button"
          @click="chatwootForm.enabled = !chatwootForm.enabled"
          :class="[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
            chatwootForm.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          ]"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              chatwootForm.enabled ? 'translate-x-5' : 'translate-x-0'
            ]"
          />
        </button>
      </div>

      <div v-if="chatwootForm.enabled" class="space-y-4">
        <!-- Chatwoot URL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Chatwoot URL *
          </label>
          <input
            v-model="chatwootForm.url"
            type="url"
            class="input-field"
            placeholder="https://your-chatwoot-instance.com"
            required
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The base URL of your Chatwoot instance (without /api/v1)
          </p>
        </div>

        <!-- Global API Token -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Global API Token
          </label>
          <div class="relative">
            <input
              v-model="chatwootForm.apiToken"
              :type="showChatwootApiToken ? 'text' : 'password'"
              class="input-field pr-10"
              :placeholder="hasChatwootApiToken ? 'Leave empty to keep current token' : 'Enter global Chatwoot API token'"
              autocomplete="new-password"
            />
            <button
              type="button"
              @click="showChatwootApiToken = !showChatwootApiToken"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg v-if="showChatwootApiToken" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
              <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Optional: Global API token used as fallback when agents don't have their own token configured
          </p>
        </div>

        <!-- Save Button -->
        <div class="flex items-center space-x-4 pt-4">
          <button
            type="button"
            @click="handleChatwootSubmit"
            :disabled="settingsStore.loading || !isChatwootFormValid"
            class="btn-primary"
          >
            <span v-if="settingsStore.loading" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </span>
            <span v-else>Save Chatwoot Settings</span>
          </button>
          
          <button
            type="button"
            @click="resetChatwootForm"
            :disabled="settingsStore.loading"
            class="btn-secondary"
          >
            Reset
          </button>
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

// Chatwoot form data
const chatwootForm = reactive({
  enabled: false,
  url: '',
  apiToken: ''
})

// Chatwoot form visibility toggles
const showChatwootApiToken = ref(false)

// Real-time input sanitization watchers
watch(() => chatwootForm.url, (newValue) => {
  const sanitized = sanitizeUrl(newValue)
  if (newValue !== sanitized) {
    chatwootForm.url = sanitized
  }
})

// Utility functions
const logSafeData = (data, label = 'Data') => {
  const safeData = { ...data }
  if (safeData.token) safeData.token = '***MASKED***'
  if (safeData.apiToken) safeData.apiToken = '***MASKED***'
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

// Chatwoot computed properties
const isChatwootConfigured = computed(() => {
  const settings = settingsStore.settings?.chatwoot
  return settings?.enabled && settings?.url
})

const isChatwootFormValid = computed(() => {
  if (!chatwootForm.enabled) return true
  
  const hasUrl = chatwootForm.url.trim().length > 0
  return hasUrl
})

const hasChatwootApiToken = computed(() => {
  return settingsStore.settings?.chatwoot?.apiToken === '***HIDDEN***'
})

// Validation
const validateChatwootForm = () => {
  if (!chatwootForm.enabled) return null
  
  const errors = {}
  
  if (!chatwootForm.url.trim()) {
    errors.url = 'Chatwoot URL is required'
  } else {
    try {
      const url = new URL(chatwootForm.url)
      if (!['https:', 'http:'].includes(url.protocol)) {
        errors.url = 'Only HTTP and HTTPS protocols are allowed'
      }
    } catch {
      errors.url = 'Please enter a valid URL'
    }
  }
  
  return Object.keys(errors).length === 0 ? null : errors
}

// Chatwoot methods
const handleChatwootSubmit = async () => {
  const validationErrors = validateChatwootForm()
  if (validationErrors) {
    const firstError = Object.values(validationErrors)[0]
    toast(firstError, { type: 'error' })
    return
  }

  try {
    const updateData = {
      chatwoot: {
        enabled: chatwootForm.enabled,
        url: sanitizeUrl(chatwootForm.url)
      }
    }
    
    if (chatwootForm.apiToken.trim()) {
      updateData.chatwoot.apiToken = chatwootForm.apiToken
    }
    
    await settingsStore.updateSettings(updateData)
    
    toast('Chatwoot settings saved successfully!', { type: 'success' })
    
    if (chatwootForm.apiToken.trim()) {
      chatwootForm.apiToken = ''
    }
    showChatwootApiToken.value = false
    
  } catch (error) {
    logSafeData(error, 'Chatwoot settings error')
    toast(sanitizeErrorMessage(error) || 'Failed to save Chatwoot settings', { type: 'error' })
  }
}

const resetChatwootForm = () => {
  chatwootForm.enabled = false
  chatwootForm.url = ''
  chatwootForm.apiToken = ''
  showChatwootApiToken.value = false
}

// Initialize chatwoot form from settings
const initializeChatwootForm = () => {
  if (settingsStore.settings?.chatwoot) {
    const chatwoot = settingsStore.settings.chatwoot
    chatwootForm.enabled = chatwoot.enabled || false
    chatwootForm.url = chatwoot.url || ''
    // Don't populate the API token field - it's hidden for security
  }
}

// Watch for settings changes to initialize form
watch(() => settingsStore.settings, initializeChatwootForm, { immediate: true })
</script> 