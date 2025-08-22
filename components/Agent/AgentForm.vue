<template>
  <form @submit.prevent="handleSubmit" class="space-y-8">
    <!-- Basic Information -->
    <BasicInfo 
      :form="form" 
      :errors="errors" 
    />

    <!-- Webhook Configuration (if editing) -->
    <WebhookConfig 
      v-if="agent && agent._id" 
      :agent="agent" 
    />

    <!-- AI Settings -->
    <AISettings :form="form" />

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
import BasicInfo from '~/components/Agent/BasicInfo.vue'
import WebhookConfig from '~/components/Agent/WebhookConfig.vue'
import AISettings from '~/components/Agent/AISettings.vue'
import ContextDocuments from '~/components/Agent/ContextDocuments.vue'
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'
import { 
  sanitizeText, 
  sanitizeNumber, 
  sanitizeUrl, 
  sanitizeFilename, 
  sanitizeContent,
  sanitizeObject,
  schemas,
  validators
} from '~/utils/sanitize'
import { useCsrf } from '~/composables/useCsrf'

const props = defineProps({
  agent: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['submit', 'cancel', 'agentUpdated'])

// Stores
const agentsStore = useAgentsStore()
const toast = useToast()
const { csrfRequest, addCsrfToForm } = useCsrf()

// Form state - don't sanitize on initialization to allow proper editing
const form = reactive({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  prompt: props.agent?.prompt || '',
  settings: {
    temperature: sanitizeNumber(props.agent?.settings?.temperature || 0.3),
    maxTokens: sanitizeNumber(props.agent?.settings?.maxTokens || 500),
    responseDelay: sanitizeNumber(props.agent?.settings?.responseDelay || 0),
    connectionId: props.agent?.settings?.connectionId || '',
    modelId: props.agent?.settings?.modelId || '',
    chatwootApiKey: props.agent?.settings?.chatwootApiKey || ''
  },
  inboxes: props.agent?.inboxes || []
})

const errors = reactive({})
const isSubmitting = ref(false)

// Check for inbox query parameters when creating a new agent
const route = useRoute()
if (!props.agent && route.query.inboxId) {
  // Populate inbox assignment from query parameters
  const inboxData = {
    accountId: sanitizeNumber(route.query.accountId),
    inboxId: sanitizeNumber(route.query.inboxId),
    accountName: sanitizeText(route.query.accountName),
    inboxName: sanitizeText(route.query.inboxName),
    channelType: sanitizeText(route.query.channelType)
  }
  
  // Only add if all required fields are present
  if (inboxData.accountId && inboxData.inboxId) {
    form.inboxes.push(inboxData)
  }
}

// Context documents state
const contextDocuments = ref([])
const refreshingDocs = ref(new Set())
const deletingDocs = ref(new Set())
const ragSummary = ref(null)

// Add reactive variables for re-crawl progress tracking
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

// Helper function to reload agent data (including context documents)
const reloadAgentData = async () => {
  if (!props.agent?._id) return
  
  try {
    const updatedAgent = await agentsStore.fetchAgent(props.agent._id)
    // Update the reactive references with new data
    contextDocuments.value = updatedAgent.contextDocuments || []
    ragSummary.value = updatedAgent.ragSummary || null
    
    // Emit to parent to update the agent prop
    emit('agentUpdated', updatedAgent)
  } catch (error) {
    console.error('Failed to reload agent data:', error.message)
    toast('Failed to reload agent data', { type: 'error' })
  }
}

// Watch for prop changes (when editing) - don't sanitize on prop updates
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = newAgent.name || ''
    form.description = newAgent.description || ''
    form.prompt = newAgent.prompt || ''
    form.settings = {
      temperature: sanitizeNumber(newAgent.settings?.temperature || 0.3),
      maxTokens: sanitizeNumber(newAgent.settings?.maxTokens || 500),
      responseDelay: sanitizeNumber(newAgent.settings?.responseDelay || 0),
      connectionId: newAgent.settings?.connectionId || '',
      modelId: newAgent.settings?.modelId || '',
      chatwootApiKey: newAgent.settings?.chatwootApiKey || ''
    }
    form.inboxes = newAgent.inboxes || []
    
    // Load context documents from agent prop if editing
    if (newAgent._id && newAgent.contextDocuments) {
      contextDocuments.value = newAgent.contextDocuments || []
      ragSummary.value = newAgent.ragSummary || null
    }
  }
}, { immediate: true })

// Validation using the sanitization library
const validateForm = () => {
  const newErrors = {}

  // Validate name using validators
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

  // Validate prompt using validators
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

  // Validate description using validators
  if (form.description && !validators.textLength(form.description, 0, 500)) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  // Validate numeric settings using validators
  if (!validators.numberRange(form.settings.temperature, 0, 1)) {
    newErrors.temperature = 'Temperature must be between 0 and 1'
  }

  if (!validators.numberRange(form.settings.maxTokens, 1, 2000)) {
    newErrors.maxTokens = 'Max tokens must be between 1 and 2000'
  }

  if (!validators.numberRange(form.settings.responseDelay, 0, 30)) {
    newErrors.responseDelay = 'Response delay must be between 0 and 30 seconds'
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
    // Use sanitizeObject with predefined schema for agent data
    const agentData = {
      ...sanitizeObject(form, schemas.agent),
      settings: {
        ...sanitizeObject(form.settings, {
          temperature: 'number',
          maxTokens: 'number',
          responseDelay: 'number',
          connectionId: 'text',
          modelId: 'text',
          chatwootApiKey: 'text'
        })
      },
      inboxes: form.inboxes || []
    }
    
    // Clean up null/empty values
    if (!agentData.settings.connectionId) agentData.settings.connectionId = null
    if (!agentData.settings.modelId) agentData.settings.modelId = null
    if (!agentData.settings.chatwootApiKey) agentData.settings.chatwootApiKey = null

    emit('submit', agentData)
  } catch (error) {
    console.error('Form submission error:', error)
    
    // Handle different types of errors with specific messages
    if (error.statusCode === 401) {
      toast('Authentication required. Please log in again.', { type: 'error' })
    } else if (error.statusCode === 403 && error.statusMessage?.includes('CSRF')) {
      toast('Security token expired. Please refresh the page.', { type: 'error' })
    } else if (error.message === 'Could not obtain CSRF token') {
      toast('Authentication issue. Please try logging out and logging back in.', { type: 'error' })
    } else {
      toast(error.message || 'Failed to submit form', { type: 'error' })
    }
  } finally {
    isSubmitting.value = false
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
      
      // Fallback to original method
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
              phase: sanitizeText(progress.phase || ''),
              message: sanitizeText(progress.message || ''),
              currentPage: sanitizeNumber(progress.currentPage || 0),
              totalPages: sanitizeNumber(progress.totalPages || doc.metadata?.crawlOptions?.maxPages || 10),
              percentage: sanitizeNumber(progress.percentage || 0),
              currentUrl: sanitizeUrl(progress.currentUrl || ''),
              docId: sanitizeText(docId)
            })
          }
        )
      } catch (progressError) {
        console.warn('Progress version failed for website re-crawl, falling back to standard method:', progressError.message)
        
        // Update progress to show fallback
        Object.assign(reCrawlingProgress, {
          phase: 'crawling',
          message: 'Re-crawling website (progress not available)...',
          currentPage: 0,
          totalPages: doc.metadata?.crawlOptions?.maxPages || 10,
          percentage: 50, // Show indeterminate progress
          currentUrl: '',
          docId: docId
        })
        
        // Fallback to original method
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

 