<template>
  <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
    <div class="flex justify-between items-start mb-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">Context Documents</h2>
      
      <!-- RAG Summary -->
      <div v-if="ragSummary" class="text-right">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <div class="flex items-center space-x-2">
            <svg class="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
            <span class="font-medium">Vector DB:</span>
            <span :class="ragSummary.documentsInRAG > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'">
              {{ ragSummary.documentsInRAG }}/{{ ragSummary.totalDocuments }} docs
            </span>
            <span v-if="ragSummary.totalChunks > 0" class="text-gray-500">
              ({{ ragSummary.totalChunks }} chunks)
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Existing Documents -->
    <div v-if="contextDocuments && contextDocuments.length > 0" class="space-y-3 mb-6">
      <div
        v-for="doc in contextDocuments"
        :key="doc._id"
        class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3 flex-1 min-w-0">
            <div class="flex-shrink-0 mt-0.5">
              <DocumentIcon v-if="doc.type === 'file'" class="h-5 w-5 text-gray-400" />
              <LinkIcon v-else-if="doc.type === 'url'" class="h-5 w-5 text-gray-400" />
              <svg v-else-if="doc.type === 'website'" class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white flex items-baseline">
                <span class="truncate">{{ doc.type === 'website' ? doc.url : (doc.filename || doc.url) }}</span>
                <span v-if="doc.type === 'website' && getSanitizedTotalPages(doc)" class="ml-2 flex-shrink-0 font-normal text-gray-500">
                  ({{ getSanitizedTotalPages(doc) }} pages)
                </span>
              </p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                <span class="font-medium capitalize">{{ doc.type }}</span>
                <span class="text-gray-400 dark:text-gray-500">&bull;</span>
                <span>{{ formatDate(doc.uploadedAt) }}</span>
                <span class="text-gray-400 dark:text-gray-500">&bull;</span>
                <span>{{ formatContentLength(doc.contentLength) }}</span>
                
                <div class="flex items-center">
                  <span class="text-gray-400 dark:text-gray-500 mr-3">&bull;</span>
                  <div 
                    v-if="doc.rag?.inRAG" 
                    class="flex items-center space-x-1 text-green-600 dark:text-green-400"
                    :title="`Vector Database: ${doc.rag.chunksCount} chunks stored`"
                  >
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-xs font-medium">RAG</span>
                  </div>
                  <div 
                    v-else 
                    class="flex items-center space-x-1 text-gray-400 dark:text-gray-500"
                    title="Not indexed in vector database"
                  >
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-xs">No RAG</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 ml-3 flex-shrink-0">
            <button
              v-if="doc._id"
              type="button"
              @click="viewContextDocument(doc)"
              class="text-blue-600 hover:text-blue-700 text-sm whitespace-nowrap"
              title="View content"
            >
              {{ expandedDocs[doc._id] ? 'Hide' : 'View' }}
            </button>
            <button
              v-if="doc._id && (doc.type === 'url' || doc.type === 'website')"
              type="button"
              @click="$emit('refresh-document', doc._id)"
              :disabled="refreshingDocs.has(doc._id)"
              class="text-green-600 hover:text-green-700 text-sm disabled:opacity-50 whitespace-nowrap"
              :title="doc.type === 'website' ? 'Re-crawl website' : 'Refresh URL content'"
            >
              <span v-if="refreshingDocs.has(doc._id)">
                {{ doc.type === 'website' ? 'Re-crawling...' : 'Refreshing...' }}
              </span>
              <span v-else>
                {{ doc.type === 'website' ? 'Re-crawl' : 'Refresh' }}
              </span>
            </button>
            <button
              v-if="doc._id"
              type="button"
              @click="$emit('remove-document', doc._id)"
              :disabled="deletingDocs.has(doc._id)"
              class="text-red-600 hover:text-red-700 text-sm disabled:opacity-50 whitespace-nowrap"
              title="Remove document"
            >
              <span v-if="deletingDocs.has(doc._id)">Removing...</span>
              <span v-else>Remove</span>
            </button>
          </div>
        </div>
        
        <!-- Re-crawl Progress Display (for websites only) -->
        <div v-if="reCrawlingProgress.isActive && reCrawlingProgress.docId === doc._id" class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <h4 class="text-sm font-medium text-green-900 dark:text-green-200 mb-3">
            Re-crawling Progress
          </h4>
          
          <!-- Progress Bar -->
          <div class="mb-3">
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs text-green-700 dark:text-green-300">
                {{ reCrawlingProgress.message }}
              </span>
              <span class="text-xs font-medium text-green-700 dark:text-green-300">
                {{ reCrawlingProgress.percentage }}%
              </span>
            </div>
            <div class="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
              <div 
                class="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out"
                :style="{ width: `${reCrawlingProgress.percentage}%` }"
              ></div>
            </div>
          </div>
          
          <!-- Status Details -->
          <div class="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span class="font-medium text-green-900 dark:text-green-200">Phase:</span>
              <span class="text-green-700 dark:text-green-300 ml-1 capitalize">{{ reCrawlingProgress.phase }}</span>
            </div>
            <div>
              <span class="font-medium text-green-900 dark:text-green-200">Pages:</span>
              <span class="text-green-700 dark:text-green-300 ml-1">
                {{ reCrawlingProgress.currentPage }}/{{ reCrawlingProgress.totalPages }}
              </span>
            </div>
          </div>
          
          <!-- Current URL being crawled -->
          <div v-if="reCrawlingProgress.currentUrl && reCrawlingProgress.phase === 'crawling'" class="mt-2 text-xs">
            <span class="font-medium text-green-900 dark:text-green-200">Current URL:</span>
            <span class="text-green-700 dark:text-green-300 ml-1 break-all">{{ reCrawlingProgress.currentUrl }}</span>
          </div>
        </div>
        
        <!-- Expanded View -->
        <div v-if="expandedDocs[doc._id]" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div v-if="expandedDocs[doc._id].loading" class="text-sm text-gray-500">Loading...</div>
          <div v-else-if="expandedDocs[doc._id].error" class="text-sm text-red-500">
            Error: {{ expandedDocs[doc._id].error }}
          </div>
          <div v-else-if="expandedDocs[doc._id].data" class="space-y-3">
            <template v-if="doc.type === 'website'">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                Scraped URLs ({{ expandedDocs[doc._id].data.metadata?.pageUrls?.length || 0 }})
              </h4>
              <ul v-if="expandedDocs[doc._id].data.metadata.pageUrls?.length" class="max-h-60 overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                <li v-for="url in expandedDocs[doc._id].data.metadata.pageUrls" :key="url" class="break-all">
                  {{ sanitizeUrl(url) }}
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500">No scraped URLs found.</p>
            </template>
            <template v-else>
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">Content</h4>
              <pre class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans bg-gray-100 dark:bg-gray-800 p-3 rounded-md max-h-60 overflow-y-auto">{{ sanitizeText(expandedDocs[doc._id].data.content || 'No content available') }}</pre>
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <!-- RAG Search Utility -->
    <RAGSearchUtility 
      v-if="ragSummary && ragSummary.totalChunks > 0"
      :agent-id="agentId"
    />
    
    <!-- Add New Context -->
    <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
      <div class="text-center">
        <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
        <div class="mt-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">
            Add Context Documents
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            Upload files or add URLs to provide additional context for your agent
          </p>
        </div>
        
        <div class="mt-4 flex justify-center space-x-4">
          <button
            type="button"
            @click="$refs.fileInput?.click()"
            :disabled="fileUploading"
            class="btn-secondary text-sm"
          >
            <span v-if="fileUploading" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Uploading...
            </span>
            <span v-else>Choose File</span>
          </button>
          <button
            type="button"
            @click="showUrlInput = !showUrlInput"
            class="btn-secondary text-sm"
          >
            Add URL
          </button>
          <button
            type="button"
            @click="showWebsiteInput = !showWebsiteInput"
            class="btn-secondary text-sm"
          >
            Add Website
          </button>
        </div>
        
        <!-- URL Input -->
        <UrlInput
          v-if="showUrlInput"
          @add-url="$emit('add-url', $event)"
          @close="showUrlInput = false"
        />
        
        <!-- Website Input -->
        <WebsiteInput
          v-if="showWebsiteInput"
          :agent-id="agentId"
          @add-website="$emit('add-website', $event)"
          @close="showWebsiteInput = false"
        />
        
        <!-- Hidden file input -->
        <input
          ref="fileInput"
          type="file"
          class="sr-only"
          @change="handleFileUpload"
          accept=".pdf,.txt,.doc,.docx,.md,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/x-markdown"
          :disabled="fileUploading"
        />
        
        <!-- File upload progress -->
        <div v-if="fileUploading" class="mt-4">
          <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              class="bg-primary-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${fileUploadProgress}%` }"
            ></div>
          </div>
          <p class="text-xs text-gray-500 mt-1 text-center">Processing file...</p>
        </div>
        
        <!-- File type help text -->
        <div v-if="!fileUploading" class="mt-4">
          <p class="text-xs text-gray-500 text-center">
            Supported file types: PDF, TXT, DOC, DOCX, MD (max 10MB)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { DocumentIcon, LinkIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import RAGSearchUtility from '~/components/Agent/RAGSearchUtility.vue'
import UrlInput from '~/components/Agent/UrlInput.vue'
import WebsiteInput from '~/components/Agent/WebsiteInput.vue'
import { sanitizeText, sanitizeUrl, sanitizeFilename, sanitizeNumber } from '~/utils/sanitize'

const props = defineProps({
  agentId: {
    type: String,
    required: true
  },
  contextDocuments: {
    type: Array,
    default: () => []
  },
  ragSummary: {
    type: Object,
    default: () => null
  },
  refreshingDocs: {
    type: Set,
    default: () => new Set()
  },
  deletingDocs: {
    type: Set,
    default: () => new Set()
  },
  reCrawlingProgress: {
    type: Object,
    default: () => ({
      isActive: false,
      phase: '',
      message: '',
      currentPage: 0,
      totalPages: 0,
      percentage: 0,
      currentUrl: '',
      docId: null
    })
  }
})

const emit = defineEmits([
  'upload-file',
  'add-url', 
  'add-website',
  'refresh-document',
  'remove-document'
])

const toast = useToast()

// Local state
const showUrlInput = ref(false)
const showWebsiteInput = ref(false)
const expandedDocs = reactive({})
const fileUploading = ref(false)
const fileUploadProgress = ref(0)

const viewContextDocument = (doc) => {
  const docId = doc._id;
  if (!docId) {
    return
  }

  // Toggle expansion
  if (expandedDocs[docId]) {
    delete expandedDocs[docId]
    return
  }

  // The content is now loaded with the document list.
  // We just need to set it in the expandedDocs reactive object.
  expandedDocs[docId] = { loading: false, error: null, data: doc }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !props.agentId) return
  
  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name)
  if (!sanitizedFilename) {
    toast('Invalid filename. Please rename the file and try again.', { type: 'error' })
    event.target.value = ''
    return
  }
  
  // Validate file type
  const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/x-markdown']
  const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.md']
  const fileExtension = sanitizedFilename.toLowerCase().substring(sanitizedFilename.lastIndexOf('.'))
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    toast('File type not supported. Please upload PDF, TXT, DOC, or DOCX files.', { type: 'error' })
    event.target.value = '' // Clear the input
    return
  }
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    toast('File size too large. Maximum allowed size is 10MB.', { type: 'error' })
    event.target.value = '' // Clear the input
    return
  }
  
  fileUploading.value = true
  fileUploadProgress.value = 0
  
  try {
    emit('upload-file', file)
    
    // Clear the file input
    event.target.value = ''
    
  } catch (error) {
    console.error('File upload failed:', error.message)
    toast(error.message || 'Failed to upload file', { type: 'error' })
    event.target.value = '' // Clear the input on error
  } finally {
    fileUploading.value = false
    fileUploadProgress.value = 0
  }
}

// Utility functions
const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const formatContentLength = (length) => {
  if (!length) return '0 bytes'
  if (length < 1024) return `${length} bytes`
  if (length < 1024 * 1024) return `${(length / 1024).toFixed(1)} KB`
  return `${(length / (1024 * 1024)).toFixed(1)} MB`
}

// Helper function to get sanitized total pages for display
const getSanitizedTotalPages = (doc) => {
  if (!doc.metadata?.totalPages) return 0
  return sanitizeNumber(doc.metadata.totalPages || 0)
}
</script>

 