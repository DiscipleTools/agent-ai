<template>
  <div class="flex items-center space-x-2">
    <!-- Status Indicator -->
    <div :class="statusClass" class="w-2 h-2 rounded-full"></div>
    
    <!-- Status Text -->
    <span :class="textClass" class="text-xs font-medium">
      {{ statusText }}
    </span>
    
    <!-- Last Sync Time -->
    <span v-if="inbox.chatwoot?.lastSync" class="text-xs text-gray-500">
      {{ formatSyncTime(inbox.chatwoot.lastSync) }}
    </span>
    
    <!-- Sync Button -->
    <button
      v-if="showSyncButton"
      @click="triggerSync"
      :disabled="syncing"
      class="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
    >
      {{ syncing ? 'Syncing...' : 'Sync Now' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useInboxesStore } from '~/stores/inboxes'

const props = defineProps({
  inbox: {
    type: Object,
    required: true
  },
  showSyncButton: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['sync-completed'])

const inboxesStore = useInboxesStore()
const toast = useToast()
const syncing = ref(false)

const syncStatus = computed(() => {
  const chatwoot = props.inbox.chatwoot
  
  if (!chatwoot) {
    return {
      type: 'error',
      text: 'Not Synced',
      message: 'No Chatwoot configuration found'
    }
  }
  
  if (!chatwoot.isConfigured) {
    return {
      type: 'warning',
      text: 'Needs Configuration',
      message: 'Chatwoot connection needs to be set up'
    }
  }
  
  if (!chatwoot.lastSync) {
    return {
      type: 'warning',
      text: 'Never Synced',
      message: 'Initial sync required'
    }
  }
  
  const lastSyncTime = new Date(chatwoot.lastSync)
  const now = new Date()
  const timeDiff = now - lastSyncTime
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  
  if (hoursDiff > 24) {
    return {
      type: 'warning',
      text: 'Sync Outdated',
      message: 'Last sync was more than 24 hours ago'
    }
  }
  
  if (hoursDiff > 1) {
    return {
      type: 'info',
      text: 'Recently Synced',
      message: 'Sync is up to date'
    }
  }
  
  return {
    type: 'success',
    text: 'Up to Date',
    message: 'Recently synced with Chatwoot'
  }
})

const statusClass = computed(() => {
  switch (syncStatus.value.type) {
    case 'success':
      return 'bg-green-400'
    case 'warning':
      return 'bg-yellow-400'
    case 'error':
      return 'bg-red-400'
    case 'info':
      return 'bg-blue-400'
    default:
      return 'bg-gray-400'
  }
})

const textClass = computed(() => {
  switch (syncStatus.value.type) {
    case 'success':
      return 'text-green-700'
    case 'warning':
      return 'text-yellow-700'
    case 'error':
      return 'text-red-700'
    case 'info':
      return 'text-blue-700'
    default:
      return 'text-gray-700'
  }
})

const statusText = computed(() => syncStatus.value.text)

const triggerSync = async () => {
  syncing.value = true
  
  try {
    // Trigger a sync for this specific inbox
    await inboxesStore.syncWithChatwoot(props.inbox.accountId)
    emit('sync-completed')
  } catch (error) {
    console.error('Sync failed:', error)
    toast('Sync failed. Please check your Chatwoot connection and try again.', { type: 'error' })
  } finally {
    syncing.value = false
  }
}

const formatSyncTime = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now - date) / (1000 * 60))
  
  if (diffInMinutes < 1) {
    return 'just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInMinutes / 1440)
    return `${days}d ago`
  }
}
</script>