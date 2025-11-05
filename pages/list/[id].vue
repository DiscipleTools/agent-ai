<template>
  <div>
    <div class="mb-6">
      <div class="flex items-center space-x-4 mb-4">
        <button
          @click="$router.back()"
          class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeftIcon class="w-4 h-4 mr-1" />
          Back
        </button>
      </div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ isEditing ? 'Edit Agent' : 'Agent Details' }}
      </h1>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {{ agent?.name || 'Loading...' }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="agentsStore.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="agentsStore.error" class="text-center py-12">
      <div class="text-red-600 dark:text-red-400 mb-4">{{ agentsStore.error }}</div>
      <button @click="fetchAgent" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Agent Editor -->
    <div v-else-if="agent" class="max-w-6xl">
      <AgentForm
        :agent="agent"
        :inbox-id="route.query.inboxId"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<script setup>
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import AgentForm from '~/components/Agent/AgentForm.vue'
import { useToast } from 'vue-toastification'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const router = useRouter()
const route = useRoute()
const agentsStore = useAgentsStore()
const toast = useToast()

const agentId = route.params.id
const isEditing = ref(true)

// Computed
const agent = computed(() => agentsStore.currentAgent)

// Methods
const fetchAgent = async () => {
  try {
    await agentsStore.fetchAgent(agentId)
  } catch (error) {
    console.error('Error fetching agent:', error)
  }
}

const handleSubmit = async (agentData) => {
  try {
    await agentsStore.updateAgent(agentId, agentData)
    toast.success('Agent updated successfully!')
    // Refresh agent data to show the latest saved values
    await fetchAgent()
  } catch (error) {
    console.error('Error updating agent:', error)
    toast.error('Failed to update agent: ' + error.message)
  }
}

const handleCancel = () => {
  router.back()
}

// Fetch agent on mount
onMounted(() => {
  fetchAgent()
})
</script>
