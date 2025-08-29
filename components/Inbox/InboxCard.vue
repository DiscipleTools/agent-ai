<template>
  <div class="inbox-card bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <!-- Simplified view when Chatwoot connection is not set up -->
    <div v-if="!isChatwootConnected" class="text-center py-8">
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          {{ inbox.name }}
        </h3>
        <p class="text-sm text-gray-500">
          {{ getChannelTypeLabel(inbox.channelType) }} • Account {{ inbox.accountId }}
        </p>
      </div>
      
      <button
        @click="$emit('enable-ai-connection', inbox)"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg text-lg transition-colors"
      >
        Enable AI Connection
      </button>
    </div>

    <!-- Full view when Chatwoot connection is set up -->
    <div v-else>
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <component 
                :is="channelIcon" 
                class="w-5 h-5 text-blue-600"
              />
            </div>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              {{ inbox.name }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ getChannelTypeLabel(inbox.channelType) }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center space-x-2">
          <span 
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              inbox.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            ]"
          >
            {{ inbox.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>
      </div>

      <!-- Agent Assignment Summary -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-medium text-gray-900">Agent Configuration</h4>
          <button
            @click="$emit('manage-agents', inbox)"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Manage Agents
          </button>
        </div>
        
        <div class="space-y-2">
          <!-- Response Agent -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Response Agent:</span>
            <button 
              v-if="!inbox.responseAgent?.agentId"
              @click="$emit('create-agent', inbox)"
              class="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
            >
              create agent
            </button>
            <button 
              v-else
              @click="$emit('edit-agent', inbox.responseAgent.agentId)"
              :class="responseAgentStatus.class + ' hover:underline cursor-pointer'"
            >
              {{ responseAgentStatus.text }}
            </button>
          </div>
          
          <!-- Processing Pipeline -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Pipeline Agents:</span>
            <span class="text-gray-900">
              {{ inbox.activeAgentCount || 0 }} active / {{ inbox.agentCount || 0 }} total
            </span>
          </div>
        </div>
      </div>

      <!-- Chatwoot Integration Status -->
      <div v-if="chatwootStatus" class="mb-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">Chatwoot Integration:</span>
          <div class="flex items-center space-x-2">
            <span 
              :class="[
                'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                chatwootStatus.class
              ]"
            >
              {{ chatwootStatus.text }}
            </span>
            
            <button
              @click="$emit('configure-chatwoot', inbox)"
              class="text-blue-600 hover:text-blue-800 text-xs font-medium"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-gray-200">
        <div class="text-xs text-gray-500">
          Created {{ formatDate(inbox.createdAt) }}
        </div>
        
        <div class="flex items-center space-x-2">
          <button
            @click="$emit('view-details', inbox)"
            class="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { 
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon
} from '@heroicons/vue/24/outline'

const props = defineProps({
  inbox: {
    type: Object,
    required: true
  }
})

const emit = defineEmits([
  'manage-agents',
  'configure-chatwoot',
  'view-details',
  'create-agent',
  'edit-agent',
  'enable-ai-connection'
])

// Check if Chatwoot connection is properly set up
const isChatwootConnected = computed(() => {
  return !!(props.inbox.chatwoot?.botId && props.inbox.chatwoot?.isConfigured)
})

// Channel type label mapping
const getChannelTypeLabel = (channelType) => {
  const labelMap = {
    'web_widget': 'Web Widget',
    'website': 'Website',
    'email': 'Email',
    'api': 'API',
    'whatsapp': 'WhatsApp',
    'facebook': 'Facebook',
    'twitter': 'Twitter',
    'telegram': 'Telegram',
    'line': 'Line',
    'sms': 'SMS'
  }
  return labelMap[channelType] || channelType
}

// Channel type icon mapping
const channelIcon = computed(() => {
  const iconMap = {
    'web_widget': ChatBubbleLeftRightIcon,
    'website': GlobeAltIcon,
    'email': EnvelopeIcon,
    'whatsapp': DevicePhoneMobileIcon,
    'api': ComputerDesktopIcon
  }
  return iconMap[props.inbox.channelType] || ComputerDesktopIcon
})

// Response agent status
const responseAgentStatus = computed(() => {
  if (props.inbox.responseAgent?.agentId) {
    return {
      text: props.inbox.responseAgent.agentId.name || 'Assigned',
      class: 'text-green-600 font-medium'
    }
  }
  return {
    text: 'create agent',
    class: 'text-orange-600'
  }
})

// Chatwoot integration status
const chatwootStatus = computed(() => {
  // Only show "Not enabled" if bot is not set up
  if (!props.inbox.chatwoot?.botId) {
    return {
      text: 'Not enabled',
      class: 'bg-gray-100 text-gray-800'
    }
  }
  
  // If bot exists but not fully configured
  if (!props.inbox.chatwoot?.isConfigured) {
    return {
      text: 'Not enabled',
      class: 'bg-gray-100 text-gray-800'
    }
  }
  
  // Fully configured - don't show status at all by returning null
  return null
})



// Format date helper
const formatDate = (date) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short', 
    day: 'numeric'
  })
}
</script>

<style scoped>
.inbox-card {
  transition: all 0.2s ease-in-out;
}

.inbox-card:hover {
  transform: translateY(-1px);
}
</style>