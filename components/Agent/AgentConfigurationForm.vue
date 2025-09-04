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
            class="input-field"
            :class="{ 'border-red-500': errors.name }"
            :placeholder="`${agentType.name} Agent`"
          />
          <div class="flex justify-between mt-1">
            <p v-if="errors.name" class="text-sm text-red-600">{{ errors.name }}</p>
            <p class="text-xs text-gray-500">{{ form.name.length }}/100 characters</p>
          </div>
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            v-model="form.description"
            rows="3"
            class="input-field"
            :class="{ 'border-red-500': errors.description }"
            :placeholder="agentType.description"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="errors.description" class="text-sm text-red-600">{{ errors.description }}</p>
            <p class="text-xs text-gray-500">{{ (form.description || '').length }}/500 characters</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Response Agent Configuration -->
    <div v-if="agentType.id === 'response'" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Response Configuration</h2>
      
      <div>
        <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Response Prompt *
        </label>
        <textarea
          id="prompt"
          v-model="form.prompt"
          rows="6"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.prompt }"
          placeholder="You are a helpful customer service assistant. Respond to customer inquiries professionally and helpfully. Use the conversation context to provide relevant and accurate information."
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.prompt" class="text-sm text-red-600">{{ errors.prompt }}</p>
          <p class="text-xs text-gray-500">{{ form.prompt.length }}/2000 characters</p>
        </div>
      </div>
    </div>

    <!-- Summarize Agent Configuration -->
    <div v-else-if="agentType.id === 'summarize'" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Summarization Configuration</h2>
      
      <div class="mb-6">
        <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Summarization Prompt *
        </label>
        <textarea
          id="prompt"
          v-model="form.prompt"
          rows="6"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.prompt }"
          placeholder="You are a conversation summarization assistant. Create concise, accurate summaries of customer service conversations. Include key points, resolution status, and any follow-up actions needed."
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.prompt" class="text-sm text-red-600">{{ errors.prompt }}</p>
          <p class="text-xs text-gray-500">{{ form.prompt.length }}/2000 characters</p>
        </div>
      </div>

      <div class="mb-6">
        <label for="maxLength" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Maximum Summary Length (words)
        </label>
        <input
          id="maxLength"
          v-model.number="form.maxLength"
          type="number"
          min="50"
          max="500"
          class="input-field"
          placeholder="150"
        />
        <p class="text-xs text-gray-500 mt-1">The maximum number of words in the generated summary</p>
      </div>
    </div>

    <!-- Assignment Workflow Configuration -->
    <div v-else-if="agentType.id === 'assignment'" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Assignment Configuration</h2>
      
      <div class="mb-6">
        <label for="conditionPrompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Assignment Conditions *
        </label>
        <textarea
          id="conditionPrompt"
          v-model="form.conditionPrompt"
          rows="4"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.conditionPrompt }"
          placeholder="Describe when this agent should be assigned. Examples:
- If the language is French
- If the user is young (under 25)
- If the message is about billing issues
- If the customer seems frustrated or angry"
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.conditionPrompt" class="text-sm text-red-600">{{ errors.conditionPrompt }}</p>
          <p class="text-xs text-gray-500">{{ (form.conditionPrompt || '').length }}/500 characters</p>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          This prompt will be evaluated by AI to determine if the conversation should be assigned to the specified agent.
        </p>
      </div>

      <div class="mb-6">
        <label for="assignAgentId" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Assign to Agent *
        </label>
        <input
          id="assignAgentId"
          v-model="form.assignAgentId"
          type="text"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.assignAgentId }"
          placeholder="Enter agent ID or email"
        />
        <p v-if="errors.assignAgentId" class="text-sm text-red-600 mt-1">{{ errors.assignAgentId }}</p>
        <p class="text-xs text-gray-500 mt-1">The agent ID or email address to assign conversations to when conditions are met</p>
      </div>
    </div>

    <!-- Status Workflow Configuration -->
    <div v-else-if="agentType.id === 'status'" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Status Change Configuration</h2>
      
      <div class="mb-6">
        <label for="statusConditionPrompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status Change Conditions *
        </label>
        <textarea
          id="statusConditionPrompt"
          v-model="form.statusConditionPrompt"
          rows="4"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.statusConditionPrompt }"
          placeholder="Describe when the conversation status should be changed. Examples:
- If the conversation is hostile or aggressive
- If the customer seems satisfied with the resolution
- If the message contains words like 'thank you' or 'solved'
- If the conversation has been idle for more than 24 hours"
        ></textarea>
        <div class="flex justify-between mt-1">
          <p v-if="errors.statusConditionPrompt" class="text-sm text-red-600">{{ errors.statusConditionPrompt }}</p>
          <p class="text-xs text-gray-500">{{ (form.statusConditionPrompt || '').length }}/500 characters</p>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          This prompt will be evaluated by AI to determine if the conversation status should be changed.
        </p>
      </div>

      <div class="mb-6">
        <label for="newStatus" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Change Status To *
        </label>
        <select
          id="newStatus"
          v-model="form.newStatus"
          required
          class="input-field"
          :class="{ 'border-red-500': errors.newStatus }"
        >
          <option value="">Select status...</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="snoozed">Snoozed</option>
        </select>
        <p v-if="errors.newStatus" class="text-sm text-red-600 mt-1">{{ errors.newStatus }}</p>
        <p class="text-xs text-gray-500 mt-1">The status to change the conversation to when conditions are met</p>
      </div>
    </div>

    <!-- AI Settings (for Response and Summarize agents) -->
    <div v-if="agentType.id === 'response' || agentType.id === 'summarize'" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <AISettings :form="form" />
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
          Creating...
        </span>
        <span v-else>Create Agent</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import AISettings from '~/components/Agent/AISettings.vue'
import { 
  sanitizeText, 
  sanitizeContent, 
  sanitizeNumber,
  validators
} from '~/utils/sanitize'

const props = defineProps({
  agentType: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['submit', 'cancel'])

// Form state
const form = reactive({
  name: '',
  description: '',
  prompt: '',
  settings: {
    temperature: 0.3,
    maxTokens: 500,
    responseDelay: 0,
    connectionId: '',
    modelId: ''
  },
  // Agent type specific fields
  maxLength: 150,
  conditionPrompt: '',
  statusConditionPrompt: '',
  assignAgentId: '',
  newStatus: ''
})

const errors = reactive({})
const isSubmitting = ref(false)

// Validation
const validateForm = () => {
  const newErrors = {}

  // Basic validation
  if (!validators.textLength(form.name, 2, 100)) {
    const sanitizedName = sanitizeText(form.name)
    if (!sanitizedName) {
      newErrors.name = 'Agent name is required'
    } else if (sanitizedName.length < 2) {
      newErrors.name = 'Agent name must be at least 2 characters long'
    } else if (sanitizedName.length > 100) {
      newErrors.name = 'Agent name cannot exceed 100 characters'
    }
  }

  if (!validators.textLength(form.prompt, 10, 2000)) {
    const sanitizedPrompt = sanitizeContent(form.prompt)
    if (!sanitizedPrompt) {
      newErrors.prompt = 'System prompt is required'
    } else if (sanitizedPrompt.length < 10) {
      newErrors.prompt = 'Prompt must be at least 10 characters long'
    } else if (sanitizedPrompt.length > 2000) {
      newErrors.prompt = 'Prompt cannot exceed 2000 characters'
    }
  }

  if (form.description && !validators.textLength(form.description, 0, 500)) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  // Agent type specific validation
  if (props.agentType.id === 'assignment') {
    if (!form.conditionPrompt) {
      newErrors.conditionPrompt = 'Assignment conditions are required'
    } else if (form.conditionPrompt.length > 500) {
      newErrors.conditionPrompt = 'Assignment conditions cannot exceed 500 characters'
    }
    
    if (!form.assignAgentId) {
      newErrors.assignAgentId = 'Agent assignment is required'
    }
  }

  if (props.agentType.id === 'status') {
    if (!form.statusConditionPrompt) {
      newErrors.statusConditionPrompt = 'Status change conditions are required'
    } else if (form.statusConditionPrompt.length > 500) {
      newErrors.statusConditionPrompt = 'Status change conditions cannot exceed 500 characters'
    }
    
    if (!form.newStatus) {
      newErrors.newStatus = 'Status selection is required'
    }
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
    // Build agent data based on type
    const agentData = {
      name: sanitizeText(form.name),
      description: sanitizeContent(form.description || ''),
      prompt: sanitizeContent(form.prompt),
      agentType: 'workflow',
      settings: {
        temperature: sanitizeNumber(form.settings.temperature),
        maxTokens: sanitizeNumber(form.settings.maxTokens),
        responseDelay: sanitizeNumber(form.settings.responseDelay),
        connectionId: form.settings.connectionId || null,
        modelId: form.settings.modelId || null
      },
      trigger: buildTrigger(),
      actions: buildActions(),
      priority: 1,
      isActive: true,
      retryOnFailure: true,
      maxRetries: 3
    }

    emit('submit', agentData)
  } catch (error) {
    console.error('Form submission error:', error)
  } finally {
    isSubmitting.value = false
  }
}

const buildTrigger = () => {
  const trigger = { ...props.agentType.trigger }
  
  // Add AI-evaluated conditions for workflow types
  if (props.agentType.id === 'assignment' && form.conditionPrompt) {
    trigger.conditions = [{
      type: 'ai_evaluation',
      operator: 'equals',
      value: form.conditionPrompt,
      logicalOperator: 'AND'
    }]
  }
  
  if (props.agentType.id === 'status' && form.statusConditionPrompt) {
    trigger.conditions = [{
      type: 'ai_evaluation',
      operator: 'equals',
      value: form.statusConditionPrompt,
      logicalOperator: 'AND'
    }]
  }
  
  return trigger
}

const buildActions = () => {
  const actions = [...props.agentType.actions]
  
  // Customize actions based on form data
  actions.forEach(action => {
    if (action.type === 'ai_summarize') {
      action.parameters.maxLength = form.maxLength || 150
    } else if (action.type === 'assign_agent') {
      action.parameters.agentId = form.assignAgentId
    } else if (action.type === 'change_status') {
      action.parameters.status = form.newStatus
    }
  })
  
  return actions
}

// Set default prompt based on agent type
watch(() => props.agentType, (newType) => {
  if (newType) {
    switch (newType.id) {
      case 'response':
        form.prompt = 'You are a helpful customer service assistant. Respond to customer inquiries professionally and helpfully. Use the conversation context to provide relevant and accurate information.'
        break
      case 'summarize':
        form.prompt = 'You are a conversation summarization assistant. Create concise, accurate summaries of customer service conversations. Include key points, resolution status, and any follow-up actions needed.'
        break
      case 'assignment':
        form.prompt = 'Assignment workflow - no prompt needed'
        break
      case 'status':
        form.prompt = 'Status workflow - no prompt needed'
        break
    }
  }
}, { immediate: true })
</script>
