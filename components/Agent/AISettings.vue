<template>
  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
    <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">AI Settings</h2>
    
    <!-- LLM Model Selection -->
    <div class="mb-6">
      <div class="grid grid-cols-1 gap-6">
        <div>
          <label for="model" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Model
          </label>
          <select
            id="model"
            v-model="selectedModelOption"
            @change="onModelChange"
            class="input-field"
            :disabled="loadingConnections || !allAvailableModels.length"
          >
            <option value="">Use Default Model</option>
            <option 
              v-for="modelOption in allAvailableModels"
              :key="`${modelOption.connectionId}-${modelOption.modelId}`"
              :value="`${modelOption.connectionId}|${modelOption.modelId}`"
            >
              {{ modelOption.connectionName }} - {{ modelOption.modelName }}
            </option>
          </select>
          <p class="text-xs text-gray-500 mt-1">
            <span v-if="loadingConnections">Loading available models...</span>
            <span v-else-if="selectedModelOption">Custom model selected</span>
            <span v-else-if="defaultConnection">Default: {{ defaultConnection.connectionName }} - {{ defaultConnection.modelName }}</span>
            <span v-else>No default model configured</span>
          </p>
        </div>
      </div>
    </div>
    
    <!-- Existing AI Settings -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label for="temperature" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Temperature
        </label>
        <input
          id="temperature"
          v-model.number="form.settings.temperature"
          type="number"
          step="0.1"
          min="0"
          max="1"
          class="input-field"
        />
        <p class="text-xs text-gray-500 mt-1">Controls randomness (0 = focused, 1 = creative)</p>
      </div>
      
      <div>
        <label for="maxTokens" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Tokens
        </label>
        <input
          id="maxTokens"
          v-model.number="form.settings.maxTokens"
          type="number"
          min="1"
          max="2000"
          class="input-field"
        />
        <p class="text-xs text-gray-500 mt-1">Maximum response length</p>
      </div>
      
      <div>
        <label for="responseDelay" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Response Delay (seconds)
        </label>
        <input
          id="responseDelay"
          v-model.number="form.settings.responseDelay"
          type="number"
          min="0"
          max="30"
          class="input-field"
        />
        <p class="text-xs text-gray-500 mt-1">Delay before sending response</p>
      </div>
    </div>
    

  </div>
</template>

<script setup>
import { useAgentsStore } from '~/stores/agents'
import { sanitizeText, sanitizeNumber } from '~/utils/sanitize'

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
})

// Stores
const agentsStore = useAgentsStore()

// AI Connections state
const availableConnections = ref([])
const defaultConnection = ref(null)
const loadingConnections = ref(false)
const selectedModelOption = ref('')

// Computed properties for AI connections
const allAvailableModels = computed(() => {
  const models = []
  
  availableConnections.value.forEach(connection => {
    connection.availableModels?.forEach(model => {
      models.push({
        connectionId: sanitizeText(connection._id),
        connectionName: sanitizeText(connection.name),
        modelId: sanitizeText(model.id),
        modelName: sanitizeText(model.name || model.id),
        provider: sanitizeText(connection.provider)
      })
    })
  })
  
  return models
})

// Load AI connections
const loadAIConnections = async () => {
  loadingConnections.value = true
  try {
    const response = await agentsStore.fetchAIConnections()
    availableConnections.value = response.connections || []
    defaultConnection.value = response.defaultConnection || null
    
    // Set initial selection based on current agent settings
    updateSelectedModelOption()
  } catch (error) {
    console.error('Failed to load AI connections:', error.message)
  } finally {
    loadingConnections.value = false
  }
}

// Update selected model option based on form settings
const updateSelectedModelOption = () => {
  if (props.form.settings.connectionId && props.form.settings.modelId) {
    selectedModelOption.value = `${props.form.settings.connectionId}|${props.form.settings.modelId}`
  } else {
    selectedModelOption.value = ''
  }
}

// Handle model selection change
const onModelChange = () => {
  if (selectedModelOption.value) {
    const [connectionId, modelId] = selectedModelOption.value.split('|')
    props.form.settings.connectionId = connectionId
    props.form.settings.modelId = modelId
  } else {
    props.form.settings.connectionId = ''
    props.form.settings.modelId = ''
  }
}

// Initialize AI connections on mount
onMounted(() => {
  loadAIConnections()
})

// Watch for form changes to update selected model option
watch(() => [props.form.settings.connectionId, props.form.settings.modelId], () => {
  updateSelectedModelOption()
})

// Watch for available connections to update selected model option
watch(() => availableConnections.value, () => {
  updateSelectedModelOption()
})
</script>

 