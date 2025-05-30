<template>
  <form @submit.prevent="handleSubmit" class="space-y-8">
    <!-- Basic Information -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
      
      <div class="grid grid-cols-1 gap-6">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            maxlength="100"
            class="input-field"
            :class="{ 'border-red-500': errors.name }"
            placeholder="Customer Support Agent"
          />
          <p v-if="errors.name" class="text-red-600 text-sm mt-1">{{ errors.name }}</p>
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            v-model="form.description"
            rows="3"
            maxlength="500"
            class="input-field"
            placeholder="Handles customer support inquiries and provides helpful responses..."
          />
          <p class="text-sm text-gray-500 mt-1">{{ form.description?.length || 0 }}/500 characters</p>
        </div>
      </div>
    </div>

    <!-- System Prompt -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">System Prompt</h2>
      
      <div>
        <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          System Prompt *
        </label>
        <textarea
          id="prompt"
          v-model="form.prompt"
          rows="8"
          required
          minlength="10"
          maxlength="2000"
          class="input-field"
          :class="{ 'border-red-500': errors.prompt }"
          placeholder="You are a helpful customer support agent. Your role is to assist customers with their inquiries in a friendly and professional manner. Always be polite, clear, and provide accurate information..."
        />
        <div class="flex justify-between items-center mt-1">
          <p v-if="errors.prompt" class="text-red-600 text-sm">{{ errors.prompt }}</p>
          <p class="text-sm text-gray-500">{{ form.prompt?.length || 0 }}/2000 characters</p>
        </div>
      </div>
    </div>

    <!-- AI Settings -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">AI Settings</h2>
      
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

    <!-- Context Documents (if editing) -->
    <div v-if="agent && agent._id" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Context Documents</h2>
      
      <div v-if="agent.contextDocuments && agent.contextDocuments.length > 0" class="space-y-3 mb-6">
        <div
          v-for="(doc, index) in agent.contextDocuments"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div class="flex-shrink-0">
              <DocumentIcon v-if="doc.type === 'file'" class="h-5 w-5 text-gray-400" />
              <LinkIcon v-else class="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ doc.filename || doc.url }}
              </p>
              <p class="text-xs text-gray-500">
                {{ doc.type === 'file' ? 'File' : 'URL' }} • {{ formatDate(doc.uploadedAt) }}
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="removeContextDocument(index)"
            class="text-red-600 hover:text-red-700 text-sm"
          >
            Remove
          </button>
        </div>
      </div>
      
      <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div class="text-center">
          <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
          <div class="mt-4">
            <label for="file-upload" class="cursor-pointer">
              <span class="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
                Upload a file or add a URL
              </span>
            </label>
            <input
              id="file-upload"
              type="file"
              class="sr-only"
              @change="handleFileUpload"
              accept=".pdf,.txt,.doc,.docx"
            />
          </div>
          <div class="mt-4 flex justify-center space-x-4">
            <button
              type="button"
              @click="$refs.fileInput.click()"
              class="btn-secondary text-sm"
            >
              Choose File
            </button>
            <button
              type="button"
              @click="showUrlInput = !showUrlInput"
              class="btn-secondary text-sm"
            >
              Add URL
            </button>
          </div>
          
          <div v-if="showUrlInput" class="mt-4">
            <div class="flex space-x-2">
              <input
                v-model="urlInput"
                type="url"
                placeholder="https://example.com/document"
                class="input-field flex-1"
              />
              <button
                type="button"
                @click="addContextUrl"
                class="btn-primary"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end space-x-4">
      <button
        type="button"
        @click="$emit('cancel')"
        class="btn-secondary"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="btn-primary"
      >
        <span v-if="isSubmitting" class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          {{ agent && agent._id ? 'Updating...' : 'Creating...' }}
        </span>
        <span v-else>{{ agent && agent._id ? 'Update Agent' : 'Create Agent' }}</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import { DocumentIcon, LinkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  agent: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['submit', 'cancel'])

// Form state
const form = reactive({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  prompt: props.agent?.prompt || '',
  settings: {
    temperature: props.agent?.settings?.temperature || 0.7,
    maxTokens: props.agent?.settings?.maxTokens || 500,
    responseDelay: props.agent?.settings?.responseDelay || 0
  }
})

const errors = reactive({})
const isSubmitting = ref(false)
const showUrlInput = ref(false)
const urlInput = ref('')

// Watch for prop changes (when editing)
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = newAgent.name || ''
    form.description = newAgent.description || ''
    form.prompt = newAgent.prompt || ''
    form.settings = {
      temperature: newAgent.settings?.temperature || 0.7,
      maxTokens: newAgent.settings?.maxTokens || 500,
      responseDelay: newAgent.settings?.responseDelay || 0
    }
  }
}, { immediate: true })

// Validation
const validateForm = () => {
  const newErrors = {}

  if (!form.name?.trim()) {
    newErrors.name = 'Agent name is required'
  } else if (form.name.length > 100) {
    newErrors.name = 'Agent name cannot exceed 100 characters'
  }

  if (!form.prompt?.trim()) {
    newErrors.prompt = 'System prompt is required'
  } else if (form.prompt.length < 10) {
    newErrors.prompt = 'Prompt must be at least 10 characters long'
  } else if (form.prompt.length > 2000) {
    newErrors.prompt = 'Prompt cannot exceed 2000 characters'
  }

  if (form.description && form.description.length > 500) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  // Clear previous errors and set new ones
  Object.keys(errors).forEach(key => delete errors[key])
  Object.assign(errors, newErrors)

  return Object.keys(newErrors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    const agentData = {
      name: form.name.trim(),
      description: form.description?.trim() || '',
      prompt: form.prompt.trim(),
      settings: {
        temperature: Number(form.settings.temperature),
        maxTokens: Number(form.settings.maxTokens),
        responseDelay: Number(form.settings.responseDelay)
      }
    }

    emit('submit', agentData)
  } finally {
    isSubmitting.value = false
  }
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    // TODO: Implement file upload
    console.log('File selected:', file)
  }
}

const addContextUrl = () => {
  if (urlInput.value.trim()) {
    // TODO: Implement URL addition
    console.log('Add URL:', urlInput.value)
    urlInput.value = ''
    showUrlInput.value = false
  }
}

const removeContextDocument = (index) => {
  // TODO: Implement context document removal
  console.log('Remove document at index:', index)
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}
</script>

<style scoped>
.input-field {
  @apply block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white;
}

.btn-primary {
  @apply bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600;
}
</style> 