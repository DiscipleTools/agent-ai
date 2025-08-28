<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900">Webhook Configuration</h3>
      <button
        v-if="editable"
        @click="emit('test-webhook')"
        :disabled="testing"
        class="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
      >
        {{ testing ? 'Testing...' : 'Test Webhook' }}
      </button>
    </div>

    <div class="space-y-4">
      <!-- Webhook URL -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
        <div class="flex">
          <input
            :value="inbox.webhookUrl"
            readonly
            class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm"
          />
          <button
            @click="copyToClipboard(inbox.webhookUrl)"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
          >
            {{ urlCopied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">Configure this URL in your Chatwoot inbox webhook settings</p>
      </div>

      <!-- Webhook Secret -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Webhook Secret</label>
        <div class="flex">
          <input
            :value="inbox.webhookSecret"
            :type="showSecret ? 'text' : 'password'"
            readonly
            class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-500 text-sm"
          />
          <button
            @click="showSecret = !showSecret"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-l-0 border-gray-300 hover:bg-gray-200"
          >
            <EyeIcon v-if="!showSecret" class="h-4 w-4" />
            <EyeSlashIcon v-else class="h-4 w-4" />
          </button>
          <button
            @click="copyToClipboard(inbox.webhookSecret)"
            class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
          >
            {{ secretCopied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">Use this secret to validate webhook requests from Chatwoot</p>
      </div>

      <!-- Webhook Status -->
      <div class="pt-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-medium text-gray-900">Webhook Status</h4>
            <p class="text-sm text-gray-500">
              {{ webhookStatus.message }}
            </p>
          </div>
          <span :class="webhookStatus.class"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
            {{ webhookStatus.text }}
          </span>
        </div>

        <!-- Webhook Instructions -->
        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 class="text-sm font-medium text-blue-800 mb-2">Setup Instructions</h4>
          <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Go to your Chatwoot inbox settings</li>
            <li>Find the "Webhook" or "Integration" section</li>
            <li>Add the webhook URL above</li>
            <li>Set the webhook secret if your Chatwoot supports it</li>
            <li>Enable webhook events for "message_created"</li>
            <li>Save your settings and test the webhook</li>
          </ol>
        </div>
      </div>

      <!-- Recent Webhook Activity -->
      <div v-if="recentActivity && recentActivity.length > 0" class="pt-4 border-t border-gray-200">
        <h4 class="font-medium text-gray-900 mb-3">Recent Activity</h4>
        <div class="space-y-2">
          <div v-for="activity in recentActivity" :key="activity.id" 
               class="flex items-center justify-between text-sm">
            <div class="flex items-center space-x-2">
              <div :class="activity.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'"
                   class="w-2 h-2 rounded-full"></div>
              <span class="text-gray-700">{{ activity.event }}</span>
            </div>
            <div class="flex items-center space-x-2 text-gray-500">
              <span>{{ formatTime(activity.timestamp) }}</span>
              <span :class="activity.success ? 'text-green-600' : 'text-red-600'">
                {{ activity.success ? 'Success' : 'Failed' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  inbox: {
    type: Object,
    required: true
  },
  editable: {
    type: Boolean,
    default: true
  },
  testing: {
    type: Boolean,
    default: false
  },
  recentActivity: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['test-webhook'])

const showSecret = ref(false)
const urlCopied = ref(false)
const secretCopied = ref(false)

const webhookStatus = computed(() => {
  const hasUrl = !!props.inbox.webhookUrl
  const hasSecret = !!props.inbox.webhookSecret
  
  if (!hasUrl) {
    return {
      text: 'Not Configured',
      class: 'bg-red-100 text-red-800',
      message: 'Webhook URL not generated. Contact support.'
    }
  }
  
  if (!hasSecret) {
    return {
      text: 'Partially Configured',
      class: 'bg-yellow-100 text-yellow-800',
      message: 'Webhook secret not set. Security may be compromised.'
    }
  }
  
  return {
    text: 'Configured',
    class: 'bg-green-100 text-green-800',
    message: 'Webhook is properly configured and ready to receive events.'
  }
})

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    
    if (text === props.inbox.webhookUrl) {
      urlCopied.value = true
      setTimeout(() => { urlCopied.value = false }, 2000)
    } else {
      secretCopied.value = true
      setTimeout(() => { secretCopied.value = false }, 2000)
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    alert('Failed to copy to clipboard')
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>