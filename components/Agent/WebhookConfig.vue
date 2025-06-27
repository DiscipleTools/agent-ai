<template>
  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
    <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Webhook Configuration</h2>
    
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">Webhook URL</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Use this URL to integrate your agent with external services like Chatwoot
          </p>
        </div>
        <button
          type="button"
          @click="showWebhookUrl = !showWebhookUrl"
          class="btn-secondary text-sm"
        >
          {{ showWebhookUrl ? 'Hide URL' : 'Show URL' }}
        </button>
      </div>
      
      <div v-if="showWebhookUrl" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <code class="text-sm bg-gray-100 dark:bg-gray-600 px-3 py-2 rounded flex-1 break-all font-mono">
            {{ getFullWebhookUrl(agent.webhookUrl) }}
          </code>
          <button
            type="button"
            @click="copyWebhookUrl"
            class="text-primary-600 hover:text-primary-700 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
            title="Copy webhook URL"
          >
            <ClipboardIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <p class="mb-1"><strong>Usage:</strong></p>
          <ul class="list-disc list-inside space-y-1 ml-2">
            <li>Configure this URL as a webhook endpoint in your external service</li>
            <li>The agent will respond to incoming messages automatically</li>
            <li>Supports Chatwoot and other webhook-compatible platforms</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ClipboardIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'

const props = defineProps({
  agent: {
    type: Object,
    required: true
  }
})

const toast = useToast()
const showWebhookUrl = ref(false)

// Webhook URL functions
const getFullWebhookUrl = (webhookPath) => {
  if (!webhookPath) return 'Not generated'
  
  // Get the current origin (protocol + host + port)
  const origin = window.location.origin
  return `${origin}${webhookPath}`
}

const copyWebhookUrl = async () => {
  if (!props.agent?.webhookUrl) {
    toast('No webhook URL available', { type: 'error' })
    return
  }
  
  try {
    const fullUrl = getFullWebhookUrl(props.agent.webhookUrl)
    await navigator.clipboard.writeText(fullUrl)
    toast('Webhook URL copied to clipboard', { type: 'success' })
  } catch (error) {
    console.error('Failed to copy webhook URL:', error.message)
    toast('Failed to copy webhook URL', { type: 'error' })
  }
}
</script>

 