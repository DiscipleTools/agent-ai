<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Agent AI Server
        </h1>
        <h2 class="mt-6 text-2xl font-medium text-gray-900 dark:text-white">
          Complete Your Account Setup
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          You've been invited to join Agent AI Server
        </p>
      </div>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Validating invitation...
          </p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
          <div class="text-red-600 dark:text-red-400 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Invalid or Expired Invitation
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            {{ error }}
          </p>
          <NuxtLink to="/login" class="btn-primary">
            Go to Login
          </NuxtLink>
        </div>

        <!-- Setup Form -->
        <form v-else @submit.prevent="handleSubmit" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              :value="sanitizeEmail(invitationData?.email)"
              type="email"
              disabled
              class="input-field bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              class="input-field"
              placeholder="Enter your full name"
              maxlength="100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password *
            </label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="8"
                class="input-field pr-10"
                :class="{ 'border-red-500': form.password && !isStrongPassword }"
                placeholder="Create a secure password"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg v-if="showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <div class="text-xs mt-1 space-y-1">
              <p class="text-gray-500 dark:text-gray-400">
                Password must contain:
              </p>
              <ul class="text-xs space-y-1 ml-4">
                <li :class="form.password.length >= 8 ? 'text-green-600' : 'text-gray-500'">
                  ✓ At least 8 characters
                </li>
                <li :class="/[A-Z]/.test(form.password) ? 'text-green-600' : 'text-gray-500'">
                  ✓ One uppercase letter
                </li>
                <li :class="/[a-z]/.test(form.password) ? 'text-green-600' : 'text-gray-500'">
                  ✓ One lowercase letter
                </li>
                <li :class="/[0-9]/.test(form.password) ? 'text-green-600' : 'text-gray-500'">
                  ✓ One number
                </li>
                <li :class="/[^A-Za-z0-9]/.test(form.password) ? 'text-green-600' : 'text-gray-500'">
                  ✓ One special character
                </li>
              </ul>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password *
            </label>
            <input
              v-model="form.confirmPassword"
              type="password"
              required
              class="input-field"
              :class="{ 'border-red-500': form.confirmPassword && form.password !== form.confirmPassword }"
              placeholder="Confirm your password"
            />
            <p v-if="form.confirmPassword && form.password !== form.confirmPassword" class="text-red-600 text-xs mt-1">
              Passwords do not match
            </p>
          </div>

          <div v-if="invitationData" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Invitation Details
            </h4>
            <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><span class="font-medium">Invited by:</span> {{ sanitizeText(invitationData.invitedBy?.name) }}</p>
              <p><span class="font-medium">Role:</span> {{ sanitizeText(invitationData.role || 'User') }}</p>
              <p><span class="font-medium">Invited on:</span> {{ formatDate(invitationData.createdAt) }}</p>
            </div>
          </div>

          <button
            type="submit"
            :disabled="submitting || !isFormValid"
            class="w-full btn-primary"
          >
            <span v-if="submitting" class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Setting up account...
            </span>
            <span v-else>Complete Account Setup</span>
          </button>

          <div class="text-center">
            <NuxtLink to="/login" class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400">
              Already have an account? Sign in
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

definePageMeta({
  layout: false,
  middleware: 'guest'
})

const route = useRoute()
const { $api } = useApi()
const router = useRouter()
const toast = useToast()

// Reactive data
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const showPassword = ref(false)
const invitationData = ref(null)

const form = reactive({
  name: '',
  password: '',
  confirmPassword: ''
})

// Computed
const isStrongPassword = computed(() => {
  const pwd = form.password
  return pwd.length >= 8 && 
         /[A-Z]/.test(pwd) && 
         /[a-z]/.test(pwd) && 
         /[0-9]/.test(pwd) && 
         /[^A-Za-z0-9]/.test(pwd)
})

const isFormValid = computed(() => {
  return form.name.trim().length > 0 &&
         isStrongPassword.value &&
         form.password === form.confirmPassword
})

// Methods
const validateInvitation = async () => {
  try {
    const token = route.query.token
    if (!token) {
      throw new Error('No invitation token provided')
    }

    const response = await $api(`/api/users/validate-invitation?token=${token}`)
    
    // Handle response structure according to workspace rules
    if (response.success !== undefined) {
      // Response already has correct structure
      invitationData.value = response.data
    } else {
      // Response data is already unwrapped
      invitationData.value = response
    }
    
  } catch (err) {
    console.error('Invitation validation error:', err)
    error.value = sanitizeErrorMessage(err.data?.message || err.message || 'Invalid or expired invitation token')
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) return

  submitting.value = true
  
  try {
    const token = route.query.token
    
    const response = await $api('/api/users/complete-setup', {
      method: 'POST',
      body: {
        token,
        name: sanitizeText(form.name),
        password: form.password // Password should not be sanitized as it needs exact characters
      }
    })

    // Handle response structure according to workspace rules
    let result
    if (response.success !== undefined) {
      // Response already has correct structure
      result = response
    } else {
      // Wrap response if needed
      result = { success: true, data: response }
    }

    if (result.success) {
      toast(sanitizeText(result.message) || 'Account setup completed successfully! Please sign in.', { type: 'success' })

      // Redirect to login
      await router.push('/login')
    } else {
      throw new Error(result.message || 'Account setup failed')
    }
    
  } catch (err) {
    console.error('Account setup error:', err)
    
    const errorMessage = sanitizeErrorMessage(err.data?.message || err.message || 'Failed to complete account setup')
    toast(errorMessage, { type: 'error' })
    
  } finally {
    submitting.value = false
  }
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

// Validate invitation on mount
onMounted(() => {
  validateInvitation()
})
</script>

 