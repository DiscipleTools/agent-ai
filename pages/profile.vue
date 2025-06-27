<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Manage your account information and security settings
      </p>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="mb-6 rounded-md bg-green-50 dark:bg-green-900 p-4">
      <div class="flex">
        <CheckCircleIcon class="h-5 w-5 text-green-400" />
        <div class="ml-3">
          <p class="text-sm font-medium text-green-800 dark:text-green-200">
            {{ successMessage }}
          </p>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mb-6 rounded-md bg-red-50 dark:bg-red-900 p-4">
      <div class="flex">
        <ExclamationCircleIcon class="h-5 w-5 text-red-400" />
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            {{ error }}
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Basic Information -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Basic Information</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update your name and email address
          </p>
        </div>
        
        <form @submit.prevent="updateBasicInfo" class="p-6 space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              id="name"
              v-model="basicForm.name"
              type="text"
              required
              maxlength="100"
              class="input-field mt-1"
              placeholder="Enter your name"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum 100 characters
            </p>
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address
            </label>
            <input
              id="email"
              v-model="basicForm.email"
              type="email"
              required
              maxlength="254"
              class="input-field mt-1"
              placeholder="Enter your email"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum 254 characters
            </p>
          </div>

          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="authStore.loading || !hasBasicChanges"
              class="btn-primary"
            >
              <span v-if="authStore.loading" class="inline-flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </span>
              <span v-else>Update Information</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Change Password</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update your password to keep your account secure
          </p>
        </div>
        
        <form @submit.prevent="updatePassword" class="p-6 space-y-4">
          <div>
            <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Password
            </label>
            <input
              id="currentPassword"
              v-model="passwordForm.currentPassword"
              type="password"
              required
              maxlength="128"
              class="input-field mt-1"
              placeholder="Enter your current password"
              autocomplete="current-password"
            />
          </div>

          <div>
            <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <input
              id="newPassword"
              v-model="passwordForm.newPassword"
              type="password"
              required
              minlength="8"
              maxlength="128"
              class="input-field mt-1"
              placeholder="Enter your new password"
              autocomplete="new-password"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Password must be at least 8 characters long (max 128)
            </p>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              v-model="passwordForm.confirmPassword"
              type="password"
              required
              maxlength="128"
              class="input-field mt-1"
              :class="{ 'border-red-500': passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword }"
              placeholder="Confirm your new password"
              autocomplete="new-password"
            />
            <p v-if="passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword" class="text-xs text-red-600 mt-1">
              Passwords do not match
            </p>
          </div>

          <div class="flex justify-end">
            <button
              type="submit"
              :disabled="authStore.loading || !isPasswordFormValid"
              class="btn-primary"
            >
              <span v-if="authStore.loading" class="inline-flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </span>
              <span v-else>Change Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Account Information -->
    <div class="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-medium text-gray-900 dark:text-white">Account Information</h2>
      </div>
      
      <div class="p-6">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ authStore.user?.role === 'admin' ? 'Administrator' : 'User' }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Account Created</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatDate(authStore.user?.createdAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">
              {{ formatDate(authStore.user?.lastLogin) }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Account Status</dt>
            <dd class="mt-1">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Active
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/vue/24/solid'
import { useToast } from 'vue-toastification'
import { sanitizeText, sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const authStore = useAuthStore()
const toast = useToast()

// Reactive forms
const basicForm = reactive({
  name: '',
  email: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// State
const error = ref('')
const successMessage = ref('')

// Initialize form with current user data
onMounted(() => {
  if (authStore.user) {
    basicForm.name = authStore.user.name || ''
    basicForm.email = authStore.user.email || ''
  }
})

// Watch for user changes (in case user data is loaded after mount)
watch(() => authStore.user, (newUser) => {
  if (newUser) {
    basicForm.name = newUser.name || ''
    basicForm.email = newUser.email || ''
  }
}, { immediate: true })

// Computed properties
const hasBasicChanges = computed(() => {
  return authStore.user && (
    basicForm.name !== authStore.user.name ||
    basicForm.email !== authStore.user.email
  )
})

const isPasswordFormValid = computed(() => {
  return passwordForm.currentPassword &&
         passwordForm.newPassword &&
         passwordForm.confirmPassword &&
         passwordForm.newPassword === passwordForm.confirmPassword &&
         passwordForm.newPassword.length >= 8 &&
         passwordForm.newPassword.length <= 128
})

// Methods
const clearMessages = () => {
  error.value = ''
  successMessage.value = ''
}

const clearPasswordFormSecurely = () => {
  // Overwrite password fields multiple times for security
  const overwriteString = '0'.repeat(Math.max(
    passwordForm.currentPassword.length,
    passwordForm.newPassword.length,
    passwordForm.confirmPassword.length,
    20
  ))
  
  passwordForm.currentPassword = overwriteString
  passwordForm.newPassword = overwriteString
  passwordForm.confirmPassword = overwriteString
  
  // Clear after a tick to ensure DOM is updated
  nextTick(() => {
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  })
}

const updateBasicInfo = async () => {
  clearMessages()
  
  // Sanitize inputs before submission
  const sanitizedName = sanitizeText(basicForm.name)
  const sanitizedEmail = sanitizeEmail(basicForm.email)
  
  // Client-side validation
  if (!sanitizedName.trim()) {
    error.value = 'Name cannot be empty'
    return
  }
  
  if (!sanitizedEmail.trim()) {
    error.value = 'Email cannot be empty'
    return
  }
  
  // Basic email format validation (additional to browser validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitizedEmail)) {
    error.value = 'Please enter a valid email address'
    return
  }
  
  try {
    await authStore.updateProfile({
      name: sanitizedName,
      email: sanitizedEmail
    })
    
    successMessage.value = 'Profile information updated successfully!'
    toast('Profile updated successfully!', { type: 'success' })
  } catch (err) {
    const sanitizedError = sanitizeErrorMessage(err)
    error.value = sanitizedError
    toast(sanitizedError, { type: 'error' })
  }
}

const updatePassword = async () => {
  clearMessages()
  
  // Client-side validation
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }
  
  if (passwordForm.newPassword.length < 8) {
    error.value = 'New password must be at least 8 characters long'
    return
  }
  
  if (passwordForm.newPassword.length > 128) {
    error.value = 'Password cannot be longer than 128 characters'
    return
  }
  
  try {
    await authStore.updateProfile({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })
    
    // Clear password form securely
    clearPasswordFormSecurely()
    
    successMessage.value = 'Password changed successfully!'
    toast('Password changed successfully!', { type: 'success' })
  } catch (err) {
    const sanitizedError = sanitizeErrorMessage(err)
    error.value = sanitizedError
    toast(sanitizedError, { type: 'error' })
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Clear messages and password form when component unmounts
onUnmounted(() => {
  clearMessages()
  clearPasswordFormSecurely()
})
</script> 