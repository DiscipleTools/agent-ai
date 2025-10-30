<template>
  <form @submit.prevent="handleSubmit" class="space-y-8">
    <!-- Basic Information -->
    <div class="card">
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Basic Information
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agent Name *
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            placeholder="Customer Support Agent"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="{ 'border-red-500': errors.name }"
          />
          <p v-if="errors.name" class="mt-1 text-sm text-red-600 dark:text-red-400">
            {{ errors.name }}
          </p>
        </div>
        
        <div>
          <label for="isActive" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            id="isActive"
            v-model="form.isActive"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option :value="true">Active</option>
            <option :value="false">Inactive</option>
          </select>
        </div>
      </div>
      
      <div class="mt-4">
        <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="description"
          v-model="form.description"
          rows="3"
          placeholder="Describe what this agent does..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          :class="{ 'border-red-500': errors.description }"
        ></textarea>
        <p v-if="errors.description" class="mt-1 text-sm text-red-600 dark:text-red-400">
          {{ errors.description }}
        </p>
      </div>
      
    </div>

    <!-- Triggers Section -->
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Triggers
        </h3>
        <button
          type="button"
          @click="addTrigger"
          class="btn-secondary text-sm"
        >
          Add Trigger
        </button>
      </div>
      
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Define when this agent should activate. At least one trigger is required.
      </p>
      
      <div v-if="form.workflow.triggers.length === 0" class="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p class="text-gray-500 dark:text-gray-400 mb-4">No triggers configured</p>
        <button
          type="button"
          @click="addTrigger"
          class="btn-primary"
        >
          Add Your First Trigger
        </button>
      </div>
      
      <div v-else class="space-y-4">
        <TriggerBuilder
          v-for="(trigger, index) in form.workflow.triggers"
          :key="`trigger-${index}`"
          :trigger="trigger"
          :metadata="metadata"
          :index="index"
          @update="updateTrigger(index, $event)"
          @remove="removeTrigger(index)"
        />
      </div>
      
      <p v-if="errors.triggers" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ errors.triggers }}
      </p>
    </div>

    <!-- Conditions Section -->
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Conditions
        </h3>
        <button
          type="button"
          @click="addCondition"
          class="btn-secondary text-sm"
        >
          Add Condition
        </button>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Define conditions that must be met for the agent to execute. All conditions must be satisfied.
      </p>

      <div v-if="form.workflow.conditions.length === 0" class="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p class="text-gray-500 dark:text-gray-400 mb-4">No conditions configured</p>
        <button
          type="button"
          @click="addCondition"
          class="btn-primary"
        >
          Add Your First Condition
        </button>
      </div>

      <div v-else class="space-y-4">
        <ConditionBuilder
          v-for="(condition, index) in form.workflow.conditions"
          :key="`condition-${index}`"
          :condition="condition"
          :metadata="metadata"
          :index="index"
          :show-logical-operator="index > 0"
          @update="updateCondition(index, $event)"
          @remove="removeCondition(index)"
        />
      </div>
    </div>

    <!-- Actions Section -->
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Actions
        </h3>
        <button
          type="button"
          @click="addAction"
          class="btn-secondary text-sm"
        >
          Add Action
        </button>
      </div>
      
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Define what happens when the agent is triggered. Actions run in order.
      </p>
      
      <div v-if="form.workflow.actions.length === 0" class="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <p class="text-gray-500 dark:text-gray-400 mb-4">No actions configured</p>
        <button
          type="button"
          @click="addAction"
          class="btn-primary"
        >
          Add Your First Action
        </button>
      </div>
      
      <div v-else class="space-y-4">
        <ActionBuilder
          v-for="(action, index) in form.workflow.actions"
          :key="`action-${index}`"
          :action="action"
          :metadata="metadata"
          :index="index"
          @update="updateAction(index, $event)"
          @remove="removeAction(index)"
          @move-up="moveAction(index, index - 1)"
          @move-down="moveAction(index, index + 1)"
        />
      </div>
      
      <p v-if="errors.actions" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ errors.actions }}
      </p>
    </div>


    <!-- Context Documents (if editing) -->
    <ContextDocuments
      v-if="agent && agent._id"
      :agent-id="agent._id"
      :context-documents="contextDocuments"
      :rag-summary="ragSummary"
      :refreshing-docs="refreshingDocs"
      :deleting-docs="deletingDocs"
      :re-crawling-progress="reCrawlingProgress"
      @upload-file="handleFileUpload"
      @add-url="addContextUrl"
      @add-website="addContextWebsite"
      @refresh-document="refreshContextDocument"
      @remove-document="removeContextDocument"
    />

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
import ContextDocuments from '~/components/Agent/ContextDocuments.vue'
import TriggerBuilder from '~/components/Workflow/TriggerBuilder.vue'
import ActionBuilder from '~/components/Workflow/ActionBuilder.vue'
import ConditionBuilder from '~/components/Workflow/ConditionBuilder.vue'
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'
import { validators } from '~/utils/sanitize'

const props = defineProps({
  agent: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['submit', 'cancel'])

const agentsStore = useAgentsStore()
const toast = useToast()

// Form state
const form = reactive({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  prompt: '', // No default prompt needed for workflow agents
  isActive: props.agent?.isActive !== false,
  settings: props.agent?.settings ? {
    temperature: props.agent.settings.temperature || 0.3,
    maxTokens: props.agent.settings.maxTokens || 500,
    responseDelay: props.agent.settings.responseDelay || 0,
    connectionId: props.agent.settings.connectionId || '',
    modelId: props.agent.settings.modelId || ''
  } : {
    temperature: 0.3,
    maxTokens: 500,
    responseDelay: 0,
    connectionId: '',
    modelId: ''
  },
  workflow: {
    triggers: props.agent?.workflow?.triggers ? [...props.agent.workflow.triggers.map(t => ({...t}))] : [],
    conditions: props.agent?.workflow?.conditions ? [...props.agent.workflow.conditions.map(c => ({...c}))] : [],
    actions: props.agent?.workflow?.actions ? [...props.agent.workflow.actions.map(a => ({...a}))] : [],
    isActive: props.agent?.workflow?.isActive !== false
  }
})

const errors = reactive({})
const isSubmitting = ref(false)

// Workflow metadata for the builder components
const metadata = ref({
  triggers: [
    // Conversation Events - NOT FUNCTIONAL (webhook only processes message_created)
    { type: 'conversation_created', name: 'New conversation started', description: 'Triggers when a new conversation is created', category: 'conversation', disabled: true, disabledReason: 'Not processed by webhook - only message_created events work' },
    { type: 'conversation_status_changed', name: 'Conversation status changed', description: 'Triggers when conversation status changes (open, resolved, pending, snoozed)', category: 'conversation', disabled: true, disabledReason: 'Not processed by webhook - only message_created events work' },
    { type: 'conversation_assigned', name: 'Conversation assigned', description: 'Triggers when conversation is assigned to an agent', category: 'conversation', disabled: true, disabledReason: 'Not processed by webhook - only message_created events work' },
    
    // Message Events - ONLY THIS ONE WORKS
    { type: 'message_created', name: 'New message received', description: 'Triggers when a new message is received (incoming or outgoing)', category: 'message' },
    
    
    // Contact Events
  ],
  actions: [
    // AI-Powered Actions - ONLY ai_response WORKS
    { type: 'ai_response', name: 'Generate AI Response', description: 'Generate and send AI response based on conversation context', category: 'ai', parameters: [
      { name: 'prompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful customer service assistant. Always be polite and professional...', required: true },
      { name: 'includeHistory', label: 'Include message history', type: 'checkbox', default: true, required: false }
    ]},
    { type: 'ai_summarize', name: 'Summarize Conversation', description: 'Create a summary of the conversation', category: 'ai', disabled: true, disabledReason: 'Not implemented - no execution logic exists', parameters: [
      { name: 'maxLength', label: 'Maximum length (words)', type: 'number', default: 100, min: 50, max: 500, required: false }
    ]},
    { type: 'ai_categorize', name: 'Categorize Conversation', description: 'Auto-categorize the conversation based on content', category: 'ai', disabled: true, disabledReason: 'Not implemented - no execution logic exists', parameters: []},
    { type: 'ai_sentiment_analysis', name: 'Analyze Sentiment', description: 'Analyze the sentiment of messages', category: 'ai', disabled: true, disabledReason: 'Not implemented - no execution logic exists', parameters: []},
    
    // Conversation Management - ONLY change_status WORKS
    { type: 'change_status', name: 'Change Status', description: 'Update conversation status', category: 'conversation', parameters: [
      { name: 'status', label: 'New Status', type: 'select', required: true, options: [
        { value: 'open', label: 'Open' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'pending', label: 'Pending' },
        { value: 'snoozed', label: 'Snoozed' }
      ]}
    ]},
    { type: 'assign_agent', name: 'Assign Agent', description: 'Assign conversation to specific agent or team', category: 'conversation', disabled: true, disabledReason: 'Placeholder only - returns fake data, does not actually assign', parameters: [
      { name: 'agentId', label: 'Agent ID', type: 'text', placeholder: 'Enter agent ID', required: true }
    ]},
    { type: 'add_private_note', name: 'Add Private Note', description: 'Add internal note to conversation', category: 'conversation', disabled: true, disabledReason: 'Partially implemented - sends as regular message, not private note', parameters: [
      { name: 'note', label: 'Note Content', type: 'textarea', placeholder: 'Enter private note...', required: true }
    ]},
    { type: 'add_public_note', name: 'Add Public Note', description: 'Add customer-visible note', category: 'conversation', disabled: true, disabledReason: 'Partially implemented - sends as regular message, same as private note', parameters: [
      { name: 'note', label: 'Note Content', type: 'textarea', placeholder: 'Enter public note...', required: true }
    ]},
    { type: 'set_priority', name: 'Set Priority', description: 'Set conversation priority level', category: 'conversation', disabled: true, disabledReason: 'Placeholder only - returns fake data, does not actually set priority', parameters: [
      { name: 'priority', label: 'Priority Level', type: 'select', required: true, options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' }
      ]}
    ]},
    
    // Flow Control Actions
    { type: 'wait', name: 'Wait', description: 'Pause workflow execution for specified duration', category: 'flow', parameters: [
      { name: 'duration', label: 'Duration (milliseconds)', type: 'number', default: 1000, min: 100, max: 30000, required: true }
    ]},
    { type: 'set_custom_attribute', name: 'Set Custom Attribute', description: 'Set conversation custom attributes', category: 'conversation', disabled: true, disabledReason: 'Placeholder only - returns fake data, does not actually set attributes', parameters: [
      { name: 'attributeName', label: 'Attribute Name', type: 'text', placeholder: 'attribute_name', required: true },
      { name: 'attributeValue', label: 'Attribute Value', type: 'text', placeholder: 'attribute_value', required: true }
    ]},
    { type: 'update_contact_attribute', name: 'Update Contact Attribute', description: 'Modify contact custom attributes', category: 'conversation', disabled: true, disabledReason: 'Not implemented - no execution logic exists', parameters: [
      { name: 'attributeName', label: 'Attribute Name', type: 'text', placeholder: 'attribute_name', required: true },
      { name: 'attributeValue', label: 'Attribute Value', type: 'text', placeholder: 'attribute_value', required: true }
    ]},
    { type: 'mark_contact_hostile', name: 'Mark Contact as Hostile', description: 'Block the contact, add a hostile label, and resolve the conversation', category: 'conversation', parameters: []},
    { type: 'stop_workflow', name: 'Stop Workflow', description: 'Stop workflow execution', category: 'flow', disabled: true, disabledReason: 'Not implemented - no execution logic exists', parameters: []},
  ],
  conditions: [
    // Message Content
    { type: 'message_contains', name: 'Message contains text', description: 'Check if message contains specific text', category: 'message', valueType: 'text', operators: ['contains', 'not_contains', 'equals', 'not_equals'] },
    { type: 'message_is_toxic', name: 'Message is toxic', description: 'Check if message contains toxic or offensive content', category: 'message', valueType: 'boolean', operators: ['equals'], hasExamples: true, examplesPlaceholder: 'Enter examples of toxic/hostile messages (one per line):\n- Example toxic message 1\n- Example toxic message 2\n- Example toxic message 3' },

    // Conversation Properties
    { type: 'conversation_status', name: 'Conversation status', description: 'Check current conversation status', category: 'conversation', valueType: 'select', operators: ['equals', 'not_equals'], options: [
      { value: 'open', label: 'Open' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'pending', label: 'Pending' },
      { value: 'snoozed', label: 'Snoozed' }
    ]},
  ],
  operators: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' },
    { value: 'exists', label: 'exists' },
    { value: 'not_exists', label: 'does not exist' }
  ]
})

// Context documents state (for editing)
const contextDocuments = ref([])
const refreshingDocs = ref(new Set())
const deletingDocs = ref(new Set())
const ragSummary = ref(null)

// Re-crawl progress tracking
const reCrawlingProgress = reactive({
  isActive: false,
  phase: '',
  message: '',
  currentPage: 0,
  totalPages: 0,
  percentage: 0,
  currentUrl: '',
  docId: null
})

// Watch for prop changes (when editing)
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = newAgent.name || ''
    form.description = newAgent.description || ''
    form.prompt = newAgent.prompt || ''
    form.isActive = newAgent.isActive !== false

    // Update settings
    Object.assign(form.settings, {
      temperature: newAgent.settings?.temperature || 0.3,
      maxTokens: newAgent.settings?.maxTokens || 500,
      responseDelay: newAgent.settings?.responseDelay || 0,
      connectionId: newAgent.settings?.connectionId || '',
      modelId: newAgent.settings?.modelId || ''
    })

    // Update arrays by clearing and re-populating to maintain reactivity and avoid readonly props
    form.workflow.triggers.length = 0
    form.workflow.conditions.length = 0
    form.workflow.actions.length = 0

    // Push new items (creates fresh writable copies to avoid readonly props)
    if (newAgent.workflow?.triggers) {
      newAgent.workflow.triggers.forEach(t => form.workflow.triggers.push({...t}))
    }
    if (newAgent.workflow?.conditions) {
      newAgent.workflow.conditions.forEach(c => form.workflow.conditions.push({...c}))
    }
    if (newAgent.workflow?.actions) {
      newAgent.workflow.actions.forEach(a => form.workflow.actions.push({...a}))
    }

    form.workflow.isActive = newAgent.workflow?.isActive !== false
    
    // Load context documents from agent prop if editing
    if (newAgent._id && newAgent.contextDocuments) {
      contextDocuments.value = newAgent.contextDocuments || []
      ragSummary.value = newAgent.ragSummary || null
    }
  }
})

// Trigger management
const addTrigger = () => {
  form.workflow.triggers.push({
    type: '',
    isActive: true
  })
}

const updateTrigger = (index, updatedTrigger) => {
  form.workflow.triggers[index] = { ...updatedTrigger }
}

const removeTrigger = (index) => {
  form.workflow.triggers.splice(index, 1)
}

// Condition management
const addCondition = () => {
  form.workflow.conditions.push({
    type: '',
    operator: 'equals',
    value: '',
    logicalOperator: 'AND',
    examples: ''
  })
}

const updateCondition = (index, updatedCondition) => {
  form.workflow.conditions[index] = { ...updatedCondition }
}

const removeCondition = (index) => {
  form.workflow.conditions.splice(index, 1)
}

// Action management
const addAction = () => {
  form.workflow.actions.push({
    type: '',
    parameters: {},
    order: form.workflow.actions.length + 1,
    continueOnFailure: true,
    delay: 0
  })
}

const updateAction = (index, updatedAction) => {
  form.workflow.actions[index] = { ...updatedAction }
}

const removeAction = (index) => {
  form.workflow.actions.splice(index, 1)
  // Reorder remaining actions
  form.workflow.actions.forEach((action, i) => {
    action.order = i + 1
  })
}

const moveAction = (fromIndex, toIndex) => {
  if (toIndex < 0 || toIndex >= form.workflow.actions.length) return
  
  const actions = [...form.workflow.actions]
  const [movedAction] = actions.splice(fromIndex, 1)
  actions.splice(toIndex, 0, movedAction)
  
  // Update order numbers
  actions.forEach((action, i) => {
    action.order = i + 1
  })
  
  form.workflow.actions = actions
}

// Validation
const validateForm = () => {
  const newErrors = {}

  if (!validators.textLength(form.name, 2, 100)) {
    newErrors.name = 'Agent name must be between 2 and 100 characters'
  }

  if (form.description && !validators.textLength(form.description, 0, 500)) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  if (form.workflow.triggers.length === 0) {
    newErrors.triggers = 'At least one trigger is required'
  } else {
    // Validate that all triggers have a type
    const invalidTriggers = form.workflow.triggers.some(trigger => !trigger.type)
    if (invalidTriggers) {
      newErrors.triggers = 'All triggers must have a type selected'
    }
  }

  if (form.workflow.actions.length === 0) {
    newErrors.actions = 'At least one action is required'
  } else {
    // Validate that all actions have a type
    const invalidActions = form.workflow.actions.some(action => !action.type)
    if (invalidActions) {
      newErrors.actions = 'All actions must have a type selected'
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
    // Clean up the form data
    const agentData = {
      name: form.name,
      description: form.description,
      isActive: form.isActive,
      settings: {
        ...form.settings,
        connectionId: form.settings.connectionId || null,
        modelId: form.settings.modelId || null
      },
      workflow: {
        ...form.workflow,
        triggers: form.workflow.triggers.filter(t => t.type),
        conditions: form.workflow.conditions.filter(c => c.type),
        actions: form.workflow.actions.filter(a => a.type)
      }
    }

    emit('submit', agentData)
  } catch (error) {
    console.error('Form submission error:', error)
  } finally {
    isSubmitting.value = false
  }
}

// Helper function to reload agent data (including context documents)
const reloadAgentData = async () => {
  if (!props.agent?._id) return
  
  try {
    const updatedAgent = await agentsStore.fetchAgent(props.agent._id)
    contextDocuments.value = updatedAgent.contextDocuments || []
    ragSummary.value = updatedAgent.ragSummary || null
  } catch (error) {
    console.error('Failed to reload agent data:', error.message)
    toast('Failed to reload agent data', { type: 'error' })
  }
}

// Context document management functions
const addContextUrl = async (url) => {
  if (!props.agent?._id) return
  
  try {
    await agentsStore.addContextUrl(props.agent._id, url)
    toast('URL content added successfully', { type: 'success' })
    await reloadAgentData()
  } catch (error) {
    console.error('Failed to add URL:', error.message)
    toast(error.message || 'Failed to add URL content', { type: 'error' })
  }
}

const addContextWebsite = async ({ url, options, progressCallback }) => {
  if (!props.agent?._id) return
  
  try {
    // Try progress version first
    try {
      await agentsStore.addContextWebsiteWithProgress(
        props.agent._id, 
        url, 
        options,
        progressCallback
      )
    } catch (progressError) {
      console.warn('Progress version failed, falling back to standard method:', progressError.message)
      await agentsStore.addContextWebsite(props.agent._id, url, options)
    }
    
    toast('Website content added successfully', { type: 'success' })
    await reloadAgentData()
  } catch (error) {
    console.error('Failed to add website:', error.message)
    toast(error.message || 'Failed to add website content', { type: 'error' })
  }
}

const removeContextDocument = async (docId) => {
  if (!props.agent?._id || !docId || deletingDocs.value.has(docId)) {
    return // Already processing
  }
  
  deletingDocs.value.add(docId)
  
  try {
    await agentsStore.deleteContextDocument(props.agent._id, docId)
    toast('Context document removed successfully', { type: 'success' })
    await reloadAgentData()
  } catch (error) {
    console.error('Failed to remove document:', error.message)
    toast(error.message || 'Failed to remove context document', { type: 'error' })
  } finally {
    deletingDocs.value.delete(docId)
  }
}

const refreshContextDocument = async (docId) => {
  if (!props.agent?._id || !docId) {
    return
  }
  
  // Find the document to check if it's a website
  const doc = contextDocuments.value.find(d => d._id === docId)
  const isWebsite = doc?.type === 'website'
  
  refreshingDocs.value.add(docId)
  
  // Reset re-crawl progress for websites
  if (isWebsite) {
    Object.assign(reCrawlingProgress, {
      isActive: true,
      phase: 'starting',
      message: 'Initializing website re-crawl...',
      currentPage: 0,
      totalPages: doc.metadata?.crawlOptions?.maxPages || 10,
      percentage: 0,
      currentUrl: '',
      docId: docId
    })
  }
  
  try {
    let result = null
    
    if (isWebsite) {
      // Try progress version first for websites
      try {
        result = await agentsStore.refreshContextDocumentWithProgress(
          props.agent._id, 
          docId,
          (progress) => {
            // Update re-crawl progress state
            Object.assign(reCrawlingProgress, {
              phase: progress.phase || '',
              message: progress.message || '',
              currentPage: progress.currentPage || 0,
              totalPages: progress.totalPages || doc.metadata?.crawlOptions?.maxPages || 10,
              percentage: progress.percentage || 0,
              currentUrl: progress.currentUrl || '',
              docId: docId
            })
          }
        )
      } catch (progressError) {
        console.warn('Progress version failed for website re-crawl, falling back to standard method:', progressError.message)
        result = await agentsStore.refreshContextDocument(props.agent._id, docId)
      }
    } else {
      // Use standard refresh for non-website documents
      result = await agentsStore.refreshContextDocument(props.agent._id, docId)
    }
    
    toast(isWebsite ? 'Website re-crawled successfully' : 'Context document refreshed successfully', { type: 'success' })
    
    // Only reload if the refresh didn't return updated data
    if (!result || !result.contextDocument) {
      await reloadAgentData()
    } else {
      // Update local context documents with the refreshed data
      const docIndex = contextDocuments.value.findIndex(d => d._id === docId)
      if (docIndex !== -1) {
        contextDocuments.value[docIndex] = result.contextDocument
      }
      
      // Update RAG summary if provided
      if (result.ragSummary) {
        ragSummary.value = result.ragSummary
      }
    }
  } catch (error) {
    console.error('Failed to refresh document:', error.message)
    toast(error.message || 'Failed to refresh context document', { type: 'error' })
  } finally {
    refreshingDocs.value.delete(docId)
    if (isWebsite) {
      reCrawlingProgress.isActive = false
      reCrawlingProgress.docId = null
    }
  }
}

const handleFileUpload = async (file) => {
  if (!props.agent?._id) return
  
  try {
    await agentsStore.uploadContext(props.agent._id, file)
    toast(`File "${file.name}" uploaded and processed successfully`, { type: 'success' })
    await reloadAgentData()
  } catch (error) {
    console.error('File upload failed:', error.message)
    toast(error.message || 'Failed to upload file', { type: 'error' })
  }
}
</script>

 