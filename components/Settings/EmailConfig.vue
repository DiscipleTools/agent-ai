<template>
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
                  autocomplete="new-password"
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
</template>

<script setup>
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeEmail } from '~/utils/sanitize'

const settingsStore = useSettingsStore()
const { $api } = useApi()
const toast = useToast()

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

// Real-time input sanitization watchers
watch(() => emailForm.fromEmail, (newValue) => {
  const sanitized = sanitizeEmail(newValue)
  if (newValue !== sanitized) {
    emailForm.fromEmail = sanitized
  }
})

watch(() => emailForm.fromName, (newValue) => {
  const sanitized = sanitizeText(newValue)
  if (newValue !== sanitized) {
    emailForm.fromName = sanitized
  }
})

watch(() => emailForm.smtp.host, (newValue) => {
  const sanitized = sanitizeText(newValue)
  if (newValue !== sanitized) {
    emailForm.smtp.host = sanitized
  }
})

watch(() => emailForm.smtp.user, (newValue) => {
  const sanitized = sanitizeEmail(newValue)
  if (newValue !== sanitized) {
    emailForm.smtp.user = sanitized
  }
})

// Utility functions
const logSafeData = (data, label = 'Data') => {
  const safeData = { ...data }
  if (safeData.password) safeData.password = '***MASKED***'
  if (safeData.pass) safeData.pass = '***MASKED***'
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

// Rate limiting
const rateLimiters = {
  emailTest: { lastCall: 0, minInterval: 10000 }
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

// Email methods
const handleEmailSubmit = async () => {
  const validationErrors = validateEmailForm()
  if (validationErrors) {
    const firstError = Object.values(validationErrors)[0]
    toast(firstError, { type: 'error' })
    return
  }

  try {
    const updateData = {
      email: {
        enabled: emailForm.enabled,
        from: {
          email: sanitizeEmail(emailForm.fromEmail),
          name: sanitizeText(emailForm.fromName)
        }
      }
    }
    
    if (emailForm.enabled) {
      updateData.email.smtp = {
        host: sanitizeText(emailForm.smtp.host),
        port: emailForm.smtp.port,
        secure: emailForm.smtp.secure,
        auth: {
          user: sanitizeEmail(emailForm.smtp.user)
        }
      }
      
      if (emailForm.smtp.pass.trim()) {
        updateData.email.smtp.auth.pass = emailForm.smtp.pass
      }
    }
    
    await settingsStore.updateSettings(updateData)
    
    toast('Email settings saved successfully!', { type: 'success' })
    
    if (emailForm.smtp.pass.trim()) {
      emailForm.smtp.pass = ''
    }
    showSmtpPassword.value = false
    
  } catch (error) {
    logSafeData(error, 'Email settings save error')
    toast(sanitizeErrorMessage(error) || 'Failed to save email settings', { type: 'error' })
  }
}

const validateEmailForm = () => {
  if (!emailForm.enabled) return null
  
  const errors = {}
  
  if (!emailForm.fromEmail.trim()) {
    errors.fromEmail = 'From email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.fromEmail)) {
    errors.fromEmail = 'Please enter a valid email address'
  }
  
  if (!emailForm.smtp.host.trim()) {
    errors.smtpHost = 'SMTP host is required'
  }
  
  if (!emailForm.smtp.user.trim()) {
    errors.smtpUser = 'SMTP username is required'
  }
  
  if (!hasSmtpPassword.value && !emailForm.smtp.pass.trim()) {
    errors.smtpPass = 'SMTP password is required'
  }
  
  return Object.keys(errors).length === 0 ? null : errors
}

const testEmailConfiguration = async () => {
  try {
    checkRateLimit('emailTest')
  } catch (error) {
    toast(error.message, { type: 'warning' })
    return
  }

  if (testingEmail.value) return
  
  testingEmail.value = true

  try {
    const response = await $api('/api/settings/test-email', {
      method: 'POST'
    })
    
    toast(response.message || 'Email configuration test successful!', { type: 'success' })
  } catch (error) {
    logSafeData(error, 'Email test error')
    toast(sanitizeErrorMessage(error) || 'Email configuration test failed', { type: 'error' })
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

// Initialize email form from settings
const initializeEmailForm = () => {
  if (settingsStore.settings?.email) {
    const email = settingsStore.settings.email
    emailForm.enabled = email.enabled || false
    emailForm.fromEmail = email.from?.email || ''
    emailForm.fromName = email.from?.name || 'Agent AI Server'
    
    if (email.smtp) {
      emailForm.smtp.host = email.smtp.host || ''
      emailForm.smtp.port = email.smtp.port || 587
      emailForm.smtp.secure = email.smtp.secure || false
      emailForm.smtp.user = email.smtp.auth?.user || ''
    }
  }
}

// Watch for settings changes to initialize form
watch(() => settingsStore.settings, initializeEmailForm, { immediate: true })
</script> 