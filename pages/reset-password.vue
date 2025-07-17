<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div v-if="loading" class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Validating reset link...</p>
      </div>
      
      <div v-else-if="tokenInvalid" class="text-center">
        <div class="text-red-600 mb-4">
          <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Invalid or Expired Link
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <NuxtLink 
          to="/forgot-password" 
          class="btn-primary"
        >
          Request New Reset Link
        </NuxtLink>
      </div>
      
      <div v-else>
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Reset your password
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below.
          </p>
        </div>
        
        <form @submit.prevent="onSubmit" class="mt-8 space-y-6">
          <div v-if="error" class="alert-error">
            {{ error }}
          </div>
          
          <div v-if="success" class="alert-success">
            {{ success }}
          </div>
          
          <div class="space-y-4">
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password
              </label>
              <input
                v-model="form.password"
                id="password"
                type="password"
                autocomplete="new-password"
                class="input-field mt-1"
                :class="{ 'border-red-500': form.password && form.password.length < 8 }"
                placeholder="Enter your new password"
                :disabled="submitting"
                required
              />
              <p v-if="form.password && form.password.length < 8" class="text-red-600 text-sm mt-1">
                Password must be at least 8 characters
              </p>
            </div>
            
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm New Password
              </label>
              <input
                v-model="form.confirmPassword"
                id="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="input-field mt-1"
                :class="{ 'border-red-500': form.confirmPassword && form.password !== form.confirmPassword }"
                placeholder="Confirm your new password"
                :disabled="submitting"
                required
              />
              <p v-if="form.confirmPassword && form.password !== form.confirmPassword" class="text-red-600 text-sm mt-1">
                Passwords do not match
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="submitting"
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting" class="absolute left-0 inset-y-0 flex items-center pl-3">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </span>
              {{ submitting ? 'Resetting...' : 'Reset Password' }}
            </button>
          </div>
          
          <div class="text-center">
            <NuxtLink 
              to="/login" 
              class="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Back to sign in
            </NuxtLink>
          </div>
        </Form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { sanitizeErrorMessage } from '~/utils/sanitize.js'
import { useApi } from '~/composables/useApi.js'

const { $api } = useApi()

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const tokenInvalid = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref('')

// Reactive form data
const form = reactive({
  password: '',
  confirmPassword: ''
})

// Get token from URL query parameter
const token = route.query.token

// Validate token on page load
onMounted(async () => {
  if (!token) {
    tokenInvalid.value = true
    loading.value = false
    return
  }

  try {
    const response = await $api(`/api/auth/validate-reset-token?token=${token}`)
    
    if (!response.success) {
      tokenInvalid.value = true
    }
  } catch (err) {
    tokenInvalid.value = true
  } finally {
    loading.value = false
  }
})

const onSubmit = async () => {
  // Validate form
  if (!form.password || form.password.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }
  
  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }
  
  error.value = ''
  success.value = ''
  submitting.value = true
  
  try {
    const response = await $api('/api/auth/reset-password', {
      method: 'POST',
      body: { 
        token: token,
        password: form.password 
      }
    })
    
    success.value = response.message || 'Password reset successfully!'
    
    // Redirect to login after a short delay
    setTimeout(() => {
      router.push('/login')
    }, 2000)
    
  } catch (err) {
    error.value = sanitizeErrorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script> 