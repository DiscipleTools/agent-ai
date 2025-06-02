<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Configure your Agent AI Server settings
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="settingsStore.loading && !settingsStore.settings" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="settingsStore.error && !settingsStore.settings" class="card">
      <div class="text-center py-8">
        <div class="text-red-600 dark:text-red-400 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to load settings
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ settingsStore.error }}
        </p>
        <button @click="fetchSettings" class="btn-primary">
          Try Again
        </button>
      </div>
    </div>

    <!-- Settings Form -->
    <div v-else class="space-y-6">
      <!-- Prediction Guard Configuration -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Prediction Guard Configuration
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              Configure your Prediction Guard API settings for AI responses.
            </p>
          </div>
          <div v-if="settingsStore.isConfigured" class="flex items-center text-green-600 dark:text-green-400">
            <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">Configured</span>
          </div>
        </div>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key *
            </label>
            <div class="relative">
              <input
                v-model="form.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="input-field pr-10"
                :placeholder="settingsStore.hasApiKey ? 'Leave empty to keep current API key' : 'Enter your Prediction Guard API key'"
                :required="!settingsStore.hasApiKey"
              />
              <button
                type="button"
                @click="showApiKey = !showApiKey"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg v-if="showApiKey" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span v-if="settingsStore.hasApiKey">
                Your API key is already configured. Leave empty to keep the current key, or enter a new one to update it.
              </span>
              <span v-else>
                Your API key is encrypted and stored securely
              </span>
            </p>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Endpoint *
            </label>
            <input
              v-model="form.endpoint"
              type="url"
              class="input-field"
              placeholder="https://api.predictionguard.com"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model
            </label>
            <select v-model="form.model" class="input-field">
              <option value="Hermes-3-Llama-3.1-70B">Hermes-3-Llama-3.1-70B (Chat - 70B)</option>
              <option value="DeepSeek-R1-Distill-Qwen-32B">DeepSeek-R1-Distill-Qwen-32B (Chat/Reasoning - 32B)</option>
              <option value="Qwen2.5-Coder-14B-Instruct">Qwen2.5-Coder-14B-Instruct (Code Generation - 14B)</option>
              <option value="Hermes-3-Llama-3.1-8B">Hermes-3-Llama-3.1-8B (Chat - 8B)</option>
              <option value="neural-chat-7b-v3-3">neural-chat-7b-v3-3 (Chat - 7B)</option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose the model that best fits your use case. Larger models offer better performance but may have higher costs.
            </p>
          </div>
          
          <div class="flex items-center space-x-4 pt-4">
            <button
              type="submit"
              :disabled="settingsStore.loading || !isFormValid"
              class="btn-primary"
            >
              <span v-if="settingsStore.loading" class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </span>
              <span v-else>Save Settings</span>
            </button>
            
            <button
              type="button"
              @click="resetForm"
              :disabled="settingsStore.loading"
              class="btn-secondary"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <!-- Email Configuration -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Email Configuration
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              Configure email settings for user invitations and notifications.
            </p>
          </div>
          <div v-if="isEmailConfigured" class="flex items-center text-green-600 dark:text-green-400">
            <svg class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">Configured</span>
          </div>
        </div>

        <div class="space-y-6">
          <!-- Enable Email Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Email Service
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Turn on email functionality for user invitations and notifications
              </p>
            </div>
            <button
              type="button"
              @click="emailForm.enabled = !emailForm.enabled"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                emailForm.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  emailForm.enabled ? 'translate-x-5' : 'translate-x-0'
                ]"
              />
            </button>
          </div>

          <div v-if="emailForm.enabled" class="space-y-4">
            <!-- Email Provider Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Provider
              </label>
              <div class="input-field bg-gray-100 dark:bg-gray-600">
                SMTP (Email Server)
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Configure your SMTP server settings below
              </p>
            </div>

            <!-- From Email Settings -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Email *
                </label>
                <input
                  v-model="emailForm.fromEmail"
                  type="email"
                  class="input-field"
                  placeholder="noreply@yourdomain.com"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Name
                </label>
                <input
                  v-model="emailForm.fromName"
                  type="text"
                  class="input-field"
                  placeholder="Agent AI Server"
                />
              </div>
            </div>

            <!-- SMTP Settings -->
            <div v-if="emailForm.enabled" class="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">SMTP Configuration</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMTP Host *
                  </label>
                  <input
                    v-model="emailForm.smtp.host"
                    type="text"
                    class="input-field"
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Port *
                  </label>
                  <input
                    v-model.number="emailForm.smtp.port"
                    type="number"
                    class="input-field"
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              <div class="flex items-center">
                <input
                  v-model="emailForm.smtp.secure"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Use SSL/TLS (typically for port 465)
                </label>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username *
                  </label>
                  <input
                    v-model="emailForm.smtp.user"
                    type="text"
                    class="input-field"
                    placeholder="your-email@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password *
                  </label>
                  <div class="relative">
                    <input
                      v-model="emailForm.smtp.pass"
                      :type="showSmtpPassword ? 'text' : 'password'"
                      class="input-field pr-10"
                      :placeholder="hasSmtpPassword ? 'Leave empty to keep current password' : 'Enter SMTP password'"
                      :required="!hasSmtpPassword"
                    />
                    <button
                      type="button"
                      @click="showSmtpPassword = !showSmtpPassword"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg v-if="showSmtpPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                      <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Email Actions -->
            <div class="flex items-center space-x-4 pt-4">
              <button
                type="button"
                @click="handleEmailSubmit"
                :disabled="settingsStore.loading || !isEmailFormValid"
                class="btn-primary"
              >
                <span v-if="settingsStore.loading" class="flex items-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </span>
                <span v-else>Save Email Settings</span>
              </button>
              
              <button
                type="button"
                @click="testEmailConfiguration"
                :disabled="testingEmail || !isEmailConfigured"
                class="btn-secondary"
              >
                <span v-if="testingEmail" class="flex items-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Testing...
                </span>
                <span v-else>Test Email</span>
              </button>
              
              <button
                type="button"
                @click="resetEmailForm"
                :disabled="settingsStore.loading"
                class="btn-secondary"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Info -->
      <div v-if="settingsStore.settings?.updatedBy" class="card">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Settings Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600 dark:text-gray-400">Last updated by:</span>
            <span class="ml-2 font-medium text-gray-900 dark:text-white">
              {{ settingsStore.settings.updatedBy.name }}
            </span>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Last updated:</span>
            <span class="ml-2 font-medium text-gray-900 dark:text-white">
              {{ formatDate(settingsStore.settings.updatedAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'admin']
})

const settingsStore = useSettingsStore()
const { $api } = useApi()
const showApiKey = ref(false)

// Form data
const form = reactive({
  apiKey: '',
  endpoint: 'https://api.predictionguard.com',
  model: 'Hermes-3-Llama-3.1-8B'
})

// Email form data
const emailForm = reactive({
  enabled: false,
  fromEmail: '',
  fromName: 'Agent AI Server',
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: ''
  }
})

// Email form visibility toggles
const showSmtpPassword = ref(false)
const testingEmail = ref(false)

// Computed
const isFormValid = computed(() => {
  // Allow saving if:
  // 1. A new API key is being entered AND endpoint is filled, OR
  // 2. There's already an existing API key (hasApiKey) AND endpoint is filled
  const hasApiKeyInput = form.apiKey.trim().length > 0
  const hasExistingApiKey = settingsStore.hasApiKey
  const hasEndpoint = form.endpoint.trim().length > 0
  
  return (hasApiKeyInput || hasExistingApiKey) && hasEndpoint
})

// Email computed properties
const isEmailConfigured = computed(() => {
  const settings = settingsStore.settings?.email
  return settings?.enabled && settings?.from?.email
})

const isEmailFormValid = computed(() => {
  if (!emailForm.enabled) return true
  
  const hasFromEmail = emailForm.fromEmail.trim().length > 0
  
  if (emailForm.enabled) {
    const hasHost = emailForm.smtp.host.trim().length > 0
    const hasUser = emailForm.smtp.user.trim().length > 0
    const hasPass = emailForm.smtp.pass.trim().length > 0 || hasSmtpPassword.value
    return hasFromEmail && hasHost && hasUser && hasPass
  }
  
  return false
})

const hasSmtpPassword = computed(() => {
  return settingsStore.settings?.email?.smtp?.auth?.pass === '***HIDDEN***'
})

// Methods
const fetchSettings = async () => {
  try {
    await settingsStore.fetchSettings()
    if (settingsStore.settings) {
      // Don't populate API key for security
      form.endpoint = settingsStore.settings.predictionGuard.endpoint || 'https://api.predictionguard.com'
      form.model = settingsStore.settings.predictionGuard.model || 'Hermes-3-Llama-3.1-8B'
      
      // Populate email settings
      if (settingsStore.settings.email) {
        const email = settingsStore.settings.email
        emailForm.enabled = email.enabled || false
        emailForm.fromEmail = email.from?.email || ''
        emailForm.fromName = email.from?.name || 'Agent AI Server'
        
        if (email.smtp) {
          emailForm.smtp.host = email.smtp.host || ''
          emailForm.smtp.port = email.smtp.port || 587
          emailForm.smtp.secure = email.smtp.secure || false
          emailForm.smtp.user = email.smtp.auth?.user || ''
          // Don't populate password for security
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    // Show error toast if it's not a 401 (which would redirect to login)
    if (error && error.message && !error.message.includes('Access token required')) {
      const { $toast } = useNuxtApp()
      
      let errorMessage = 'Failed to load settings'
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message
        } else if (error.statusMessage) {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      $toast.error(errorMessage)
    }
  }
}

const handleSubmit = async () => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const updateData = {
      predictionGuard: {
        endpoint: form.endpoint,
        model: form.model
      }
    }
    
    // Only include API key if user entered a new one
    if (form.apiKey.trim()) {
      updateData.predictionGuard.apiKey = form.apiKey
    }
    
    const result = await settingsStore.updateSettings(updateData)
    
    // Show success message
    if (toast) {
      toast.success('Settings saved successfully!')
    }
    
    // Clear the API key field for security
    form.apiKey = ''
    showApiKey.value = false
    
  } catch (error) {
    console.error('Settings save error:', error)
    
    let errorMessage = 'Failed to save settings'
    
    try {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string') {
          errorMessage = error.message
        } else if (error.data && typeof error.data.message === 'string') {
          errorMessage = error.data.message
        } else if (typeof error.statusMessage === 'string') {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
    } catch (parseError) {
      console.error('Error parsing error:', parseError)
      errorMessage = 'Failed to save settings'
    }
    
    if (toast) {
      try {
        toast.error(errorMessage)
      } catch (toastError) {
        console.error('Could not show toast error:', toastError)
      }
    }
  }
}

const resetForm = () => {
  form.apiKey = ''
  form.endpoint = 'https://api.predictionguard.com'
  form.model = 'Hermes-3-Llama-3.1-8B'
  showApiKey.value = false
}

const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// Email methods
const handleEmailSubmit = async () => {
  let toast
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const updateData = {
      predictionGuard: {
        endpoint: form.endpoint,
        model: form.model
      },
      email: {
        enabled: emailForm.enabled,
        from: {
          email: emailForm.fromEmail,
          name: emailForm.fromName
        }
      }
    }
    
    if (emailForm.enabled) {
      updateData.email.smtp = {
        host: emailForm.smtp.host,
        port: emailForm.smtp.port,
        secure: emailForm.smtp.secure,
        auth: {
          user: emailForm.smtp.user
        }
      }
      
      // Only include password if user entered a new one
      if (emailForm.smtp.pass.trim()) {
        updateData.email.smtp.auth.pass = emailForm.smtp.pass
      }
    }
    
    await settingsStore.updateSettings(updateData)
    
    // Show success message
    if (toast) {
      toast.success('Email settings saved successfully!')
    }
    
    // Clear sensitive fields for security
    emailForm.smtp.pass = ''
    showSmtpPassword.value = false
    
  } catch (error) {
    console.error('Email settings save error:', error)
    
    let errorMessage = 'Failed to save email settings'
    
    try {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string') {
          errorMessage = error.message
        } else if (error.data && typeof error.data.message === 'string') {
          errorMessage = error.data.message
        } else if (typeof error.statusMessage === 'string') {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
    } catch (parseError) {
      console.error('Error parsing error:', parseError)
      errorMessage = 'Failed to save email settings'
    }
    
    if (toast) {
      try {
        toast.error(errorMessage)
      } catch (toastError) {
        console.error('Could not show toast error:', toastError)
      }
    }
  }
}

const testEmailConfiguration = async () => {
  testingEmail.value = true
  let toast
  
  try {
    toast = useNuxtApp().$toast
  } catch (e) {
    console.error('Could not get toast:', e)
  }

  try {
    const { $api } = useApi()
    const response = await $api('/api/settings/test-email', {
      method: 'POST'
    })
    
    if (toast) {
      toast.success(response.message || 'Email configuration test successful!')
    }
  } catch (error) {
    console.error('Email test error:', error)
    
    let errorMessage = 'Email configuration test failed'
    
    try {
      if (error && typeof error === 'object') {
        if (typeof error.message === 'string') {
          errorMessage = error.message
        } else if (error.data && typeof error.data.message === 'string') {
          errorMessage = error.data.message
        } else if (typeof error.statusMessage === 'string') {
          errorMessage = error.statusMessage
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
    } catch (parseError) {
      console.error('Error parsing error:', parseError)
      errorMessage = 'Email configuration test failed'
    }
    
    if (toast) {
      try {
        toast.error(errorMessage)
      } catch (toastError) {
        console.error('Could not show toast error:', toastError)
      }
    }
  } finally {
    testingEmail.value = false
  }
}

const resetEmailForm = () => {
  emailForm.enabled = false
  emailForm.fromEmail = ''
  emailForm.fromName = 'Agent AI Server'
  emailForm.smtp.host = ''
  emailForm.smtp.port = 587
  emailForm.smtp.secure = false
  emailForm.smtp.user = ''
  emailForm.smtp.pass = ''
  showSmtpPassword.value = false
}

// Fetch settings on mount
onMounted(() => {
  fetchSettings()
})
</script> 