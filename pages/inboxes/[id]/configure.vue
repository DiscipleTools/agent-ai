<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Loading State -->
    <div v-if="loading && !currentInbox" class="text-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p class="text-gray-500 mt-2">Loading configuration...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-400" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading configuration</h3>
          <p class="text-sm text-red-700 mt-1">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Configuration -->
    <div v-else-if="currentInbox">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center space-x-4">
          <button
            @click="router.push(`/inboxes/${currentInbox._id}`)"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeftIcon class="w-5 h-5" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Configuration</h1>
            <p class="text-gray-600 mt-1">{{ currentInbox.name }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            @click="saveConfiguration"
            :disabled="saving"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </div>

      <!-- Configuration Sections -->
      <div class="space-y-8">
        <!-- Chatwoot Integration -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Chatwoot Integration</h3>
              <p class="text-sm text-gray-500 mt-1">Configure how this inbox connects to Chatwoot</p>
            </div>
            <SyncStatus :inbox="currentInbox" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Account ID</label>
              <input
                :value="currentInbox.accountId"
                readonly
                class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
              <p class="text-xs text-gray-500 mt-1">This is set automatically from Chatwoot</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Inbox ID</label>
              <input
                :value="currentInbox.inboxId"
                readonly
                class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
              <p class="text-xs text-gray-500 mt-1">This is set automatically from Chatwoot</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Bot Configuration</label>
              <div class="flex items-center space-x-3">
                <div class="flex-1">
                  <div class="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border">
                    Bot Name: {{ currentInbox.name }} Bot
                  </div>
                  <p class="text-xs text-gray-500 mt-1">Bot name is automatically set as inbox name + "Bot"</p>
                </div>
                <button
                  @click="createOrUpdateBot"
                  :disabled="creatingBot"
                  class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {{ creatingBot ? 'Setting up...' : (currentInbox.chatwoot?.botId ? 'Update Bot' : 'Create Bot') }}
                </button>
              </div>
            </div>

          </div>

          <div class="mt-6 pt-6 border-t border-gray-200">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-medium text-gray-900">Configuration Status</h4>
                <p class="text-sm text-gray-500">
                  {{ currentInbox.chatwoot?.isConfigured ? 'Properly configured' : 'Configuration incomplete' }}
                </p>
              </div>
              <div class="flex items-center space-x-3">
                <span :class="currentInbox.chatwoot?.isConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ currentInbox.chatwoot?.isConfigured ? 'Configured' : 'Needs Setup' }}
                </span>
                <button
                  @click="testChatwootConnection"
                  :disabled="testing"
                  class="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                >
                  {{ testing ? 'Testing...' : 'Test Connection' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Webhook Configuration -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <WebhookConfig :inbox="currentInbox" :editable="false" />
        </div>

        <!-- Processing Settings -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-6">Processing Settings</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Process Delay (ms)
              </label>
              <input
                v-model.number="configForm.settings.processDelay"
                type="number"
                min="0"
                max="10000"
                step="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">Delay before processing messages (in milliseconds)</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Active Status
              </label>
              <div class="flex items-center">
                <input
                  v-model="configForm.isActive"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label class="ml-3 text-sm text-gray-900">
                  Enable message processing for this inbox
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-1">When disabled, no agents will process messages from this inbox</p>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center">
                <input
                  v-model="configForm.settings.enableLogging"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label class="ml-3 text-sm text-gray-900">
                  Enable detailed logging for debugging
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-1 ml-7">Logs all agent processing steps (may impact performance)</p>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center">
                <input
                  v-model="configForm.settings.enableAnalytics"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label class="ml-3 text-sm text-gray-900">
                  Enable analytics tracking
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-1 ml-7">Track message processing metrics and performance</p>
            </div>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-6">Advanced Settings</h3>
          
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div class="flex">
              <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400 mt-0.5" />
              <div class="ml-3">
                <h4 class="text-sm font-medium text-yellow-800">Important Notice</h4>
                <p class="text-sm text-yellow-700 mt-1">
                  This inbox is managed by Chatwoot. Changes to core settings should be made in Chatwoot, 
                  not here. These settings only affect how Agent AI processes messages from this inbox.
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Webhook Secret</label>
              <div class="relative">
                <input
                  :value="currentInbox.webhookSecret"
                  :type="showWebhookSecret ? 'text' : 'password'"
                  readonly
                  class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <button
                  @click="showWebhookSecret = !showWebhookSecret"
                  type="button"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <EyeIcon v-if="!showWebhookSecret" class="h-4 w-4 text-gray-400" />
                  <EyeSlashIcon v-else class="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-1">Used to validate webhook requests from Chatwoot</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
              <div class="flex">
                <input
                  :value="currentInbox.webhookUrl"
                  readonly
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-gray-500"
                />
                <button
                  @click="copyWebhookUrl"
                  class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
                >
                  {{ copied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-1">Configure this URL in your Chatwoot inbox webhook settings</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInboxesStore } from '~/stores/inboxes'
import WebhookConfig from '~/components/Inbox/WebhookConfig.vue'
import SyncStatus from '~/components/Inbox/SyncStatus.vue'
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/vue/24/outline'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const route = useRoute()
const inboxId = route.params.id

const inboxesStore = useInboxesStore()
const { currentInbox, loading, error } = storeToRefs(inboxesStore)

const saving = ref(false)
const testing = ref(false)
const creatingBot = ref(false)
const showWebhookSecret = ref(false)
const copied = ref(false)

const configForm = reactive({
  settings: {
    processDelay: 0,
    enableLogging: false,
    enableAnalytics: false
  },
  isActive: true
})

// Methods
const saveConfiguration = async () => {
  saving.value = true
  try {
    await inboxesStore.updateInbox(inboxId, {
      settings: configForm.settings,
      isActive: configForm.isActive
    })
    
    alert('Configuration saved successfully!')
  } catch (error) {
    console.error('Failed to save configuration:', error)
    alert('Failed to save configuration. Please try again.')
  } finally {
    saving.value = false
  }
}

const createOrUpdateBot = async () => {
  creatingBot.value = true
  try {
    const { csrfRequest } = useCsrf()
    const botName = `${currentInbox.value.name} Bot`
    const action = currentInbox.value.chatwoot?.botId ? 'recreate' : 'create'
    
    const response = await csrfRequest(`/api/inboxes/${inboxId}/bot`, {
      method: 'POST',
      body: {
        action: action,
        botName: botName
      }
    })
    
    if (response.success) {
      // Update the current inbox with the bot info
      await inboxesStore.getInbox(inboxId)
      alert(`Bot "${botName}" ${action}d successfully!`)
    } else {
      alert('Failed to create/update bot. Please check your API key.')
    }
  } catch (error) {
    console.error('Bot creation/update failed:', error)
    alert('Bot creation/update failed. Please check your API key and try again.')
  } finally {
    creatingBot.value = false
  }
}

const testChatwootConnection = async () => {
  testing.value = true
  try {
    const { csrfRequest } = useCsrf()
    // This would need to be implemented in the backend
    const response = await csrfRequest(`/api/inboxes/${inboxId}/test-chatwoot`, {
      method: 'POST',
      body: {}
    })
    
    if (response.success) {
      alert('Chatwoot connection successful!')
    } else {
      alert('Chatwoot connection failed. Please check your API key.')
    }
  } catch (error) {
    console.error('Connection test failed:', error)
    alert('Connection test failed. Please check your API key and try again.')
  } finally {
    testing.value = false
  }
}

const copyWebhookUrl = async () => {
  try {
    await navigator.clipboard.writeText(currentInbox.value.webhookUrl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy webhook URL:', error)
    alert('Failed to copy webhook URL')
  }
}

const initializeForm = () => {
  if (currentInbox.value) {
    configForm.settings.processDelay = currentInbox.value.settings?.processDelay || 0
    configForm.settings.enableLogging = currentInbox.value.settings?.enableLogging || false
    configForm.settings.enableAnalytics = currentInbox.value.settings?.enableAnalytics || false
    configForm.isActive = currentInbox.value.isActive !== false
  }
}

// Lifecycle
onMounted(async () => {
  if (inboxId) {
    await inboxesStore.getInbox(inboxId)
    initializeForm()
  }
})
</script>