<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Forgot your password?
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>
      
      <Form @submit="onSubmit" class="mt-8 space-y-6">
        <div v-if="error" class="alert-error">
          {{ error }}
        </div>
        
        <div v-if="success" class="alert-success">
          {{ success }}
        </div>
        
        <div class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <Field
              v-slot="{ field, errorMessage }"
              name="email"
              rules="required|email"
            >
              <input
                v-bind="field"
                id="email"
                type="email"
                autocomplete="email"
                class="input-field mt-1"
                :class="{ 'border-red-500': errorMessage }"
                placeholder="Enter your email"
                :disabled="loading"
              />
              <p v-if="errorMessage" class="text-red-600 text-sm mt-1">
                {{ errorMessage }}
              </p>
            </Field>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </span>
            {{ loading ? 'Sending...' : 'Send reset link' }}
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
</template>

<script setup>
import { Form, Field } from 'vee-validate'
import { sanitizeEmail, sanitizeErrorMessage } from '~/utils/sanitize.js'

definePageMeta({
  layout: 'default'
})

const { $api } = useApi()

const loading = ref(false)
const error = ref('')
const success = ref('')

const onSubmit = async (values) => {
  error.value = ''
  success.value = ''
  loading.value = true
  
  try {
    const sanitizedEmail = sanitizeEmail(values.email)
    
    const response = await $api('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: sanitizedEmail }
    })
    
    success.value = response.message || 'Password reset link sent successfully!'
  } catch (err) {
    error.value = sanitizeErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script> 