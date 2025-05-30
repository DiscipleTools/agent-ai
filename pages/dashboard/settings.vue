<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Configure your Agent AI Server settings
      </p>
    </div>

    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Prediction Guard Configuration
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Configure your Prediction Guard API settings for AI responses.
      </p>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key
          </label>
          <input
            type="password"
            class="input-field"
            placeholder="Enter your Prediction Guard API key"
            disabled
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Endpoint
          </label>
          <input
            type="url"
            class="input-field"
            placeholder="https://api.predictionguard.com/v1"
            disabled
          />
        </div>
        
        <div>
          <button class="btn-primary" disabled>
            Save Settings
          </button>
        </div>
      </div>
      
      <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
        <p class="text-sm text-blue-800 dark:text-blue-200">
          <strong>Coming Soon:</strong> Settings management will be implemented in the next phase.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
</script> 