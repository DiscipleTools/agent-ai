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
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                Chatwoot API token is now configured via environment variable (CHATWOOT_API_TOKEN). 
                No additional configuration needed here.
              </p>
            </div>
          </div>
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
import { sanitizeText } from '~/utils/sanitize'

const settingsStore = useSettingsStore()
const toast = useToast()

// Chatwoot form data
const chatwootForm = reactive({
  enabled: false
})


// No frontend URL sanitization - let the server handle it

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
  return settings?.enabled
})

const isChatwootFormValid = computed(() => {
  return true
})


// Validation
const validateChatwootForm = () => {
  return null
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
        enabled: chatwootForm.enabled
      }
    }
    
    await settingsStore.updateSettings(updateData)
    
    toast('Chatwoot settings saved successfully!', { type: 'success' })
    
  } catch (error) {
    logSafeData(error, 'Chatwoot settings error')
    toast(sanitizeErrorMessage(error) || 'Failed to save Chatwoot settings', { type: 'error' })
  }
}

const resetChatwootForm = () => {
  chatwootForm.enabled = false
}

// Initialize chatwoot form from settings
const initializeChatwootForm = () => {
  if (settingsStore.settings?.chatwoot) {
    const chatwoot = settingsStore.settings.chatwoot
    chatwootForm.enabled = chatwoot.enabled || false
  }
}

// Watch for settings changes to initialize form
watch(() => settingsStore.settings, initializeChatwootForm, { immediate: true })
</script> 