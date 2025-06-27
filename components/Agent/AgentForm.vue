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
            placeholder="Enter agent name"
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
            placeholder="Brief description of the agent's purpose"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="errors.description" class="text-sm text-red-600">{{ errors.description }}</p>
            <p class="text-xs text-gray-500">{{ (form.description || '').length }}/500 characters</p>
          </div>
        </div>

        <div>
          <label for="prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Prompt *
          </label>
          <textarea
            id="prompt"
            v-model="form.prompt"
            rows="6"
            required
            class="input-field"
            :class="{ 'border-red-500': errors.prompt }"
            placeholder="Define the agent's behavior, personality, and instructions..."
          ></textarea>
          <div class="flex justify-between mt-1">
            <p v-if="errors.prompt" class="text-sm text-red-600">{{ errors.prompt }}</p>
            <p class="text-xs text-gray-500">{{ form.prompt.length }}/2000 characters</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Webhook Configuration (if editing) -->
    <div v-if="agent && agent._id" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white mb-6">Webhook Configuration</h2>
      
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white">Webhook URL</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Use this URL to integrate your agent with external services like Chatwoot
            </p>
          </div>
          <button
            type="button"
            @click="showWebhookUrl = !showWebhookUrl"
            class="btn-secondary text-sm"
          >
            {{ showWebhookUrl ? 'Hide URL' : 'Show URL' }}
          </button>
        </div>
        
        <div v-if="showWebhookUrl" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div class="flex items-center space-x-2">
            <code class="text-sm bg-gray-100 dark:bg-gray-600 px-3 py-2 rounded flex-1 break-all font-mono">
              {{ getFullWebhookUrl(agent.webhookUrl) }}
            </code>
            <button
              type="button"
              @click="copyWebhookUrl"
              class="text-primary-600 hover:text-primary-700 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Copy webhook URL"
            >
              <ClipboardIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            <p class="mb-1"><strong>Usage:</strong></p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>Configure this URL as a webhook endpoint in your external service</li>
              <li>The agent will respond to incoming messages automatically</li>
              <li>Supports Chatwoot and other webhook-compatible platforms</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Settings -->
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
      
      <!-- Chatwoot Settings -->
      <div class="mt-6">
        <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Chatwoot Integration</h3>
        <div class="grid grid-cols-1 gap-6">
          <div>
            <label for="chatwootApiKey" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chatwoot API Key
            </label>
            <input
              id="chatwootApiKey"
              v-model="form.settings.chatwootApiKey"
              type="password"
              class="input-field"
              placeholder="Enter Chatwoot API key for this agent"
            />
            <p class="text-xs text-gray-500 mt-1">
              Optional: Agent-specific API key. If not provided, the global CHATWOOT_API_TOKEN will be used.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Documents (if editing) -->
    <div v-if="agent && agent._id" class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-3a5 5 0 00-5-5 5 5 0 00-5 5v3m0 0h10" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white flex items-baseline">
                  <span class="truncate">{{ doc.type === 'website' ? doc.url : (doc.filename || doc.url) }}</span>
                  <span v-if="doc.type === 'website' && doc.metadata?.totalPages" class="ml-2 flex-shrink-0 font-normal text-gray-500">
                    ({{ doc.metadata.totalPages }} pages)
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
                @click="refreshContextDocument(doc._id)"
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
                @click="removeContextDocument(doc._id)"
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
                    {{ url }}
                  </li>
                </ul>
                <p v-else class="text-sm text-gray-500">No scraped URLs found.</p>
              </template>
              <template v-else>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Content</h4>
                <pre class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans bg-gray-100 dark:bg-gray-800 p-3 rounded-md max-h-60 overflow-y-auto">{{ expandedDocs[doc._id].data.content || 'No content available' }}</pre>
              </template>
            </div>
          </div>
        </div>
      </div>
      
      <!-- RAG Search Utility -->
      <RAGSearchUtility 
        v-if="ragSummary && ragSummary.totalChunks > 0"
        :agent-id="agent._id"
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
          <div v-if="showUrlInput" class="mt-4 space-y-3">
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <input
                v-model="urlInput"
                type="url"
                placeholder="https://example.com/document"
                class="input-field flex-1 min-w-0"
                :disabled="urlTesting || urlAdding"
                @keyup.enter="addContextUrl"
              />
              <div class="flex space-x-2">
                <button
                  type="button"
                  @click="testUrlBeforeAdd"
                  :disabled="!urlInput.trim() || urlTesting || urlAdding"
                  class="btn-secondary text-sm whitespace-nowrap"
                >
                  <span v-if="urlTesting">Testing...</span>
                  <span v-else>Test</span>
                </button>
                <button
                  type="button"
                  @click="addContextUrl"
                  :disabled="!urlInput.trim() || urlTesting || urlAdding"
                  class="btn-primary text-sm whitespace-nowrap"
                >
                  <span v-if="urlAdding">Adding...</span>
                  <span v-else>Add</span>
                </button>
              </div>
            </div>
            
            <!-- URL Test Results -->
            <div v-if="urlTestResult" class="text-left overflow-hidden">
              <div v-if="urlTestResult.success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3 min-w-0 flex-1">
                    <h4 class="text-sm font-medium text-green-800 dark:text-green-200">URL is accessible</h4>
                    <div class="mt-1 text-sm text-green-700 dark:text-green-300">
                      <p v-if="urlTestResult.data?.title" class="break-words">Title: {{ urlTestResult.data.title }}</p>
                      <p>Content Type: {{ urlTestResult.data?.contentType || 'Unknown' }}</p>
                      <p v-if="urlTestResult.data?.contentLength">Content Length: {{ formatContentLength(urlTestResult.data.contentLength) }}</p>
                      <p v-if="urlTestResult.data?.contentPreview" class="mt-2 text-xs break-words">
                        Preview: {{ urlTestResult.data.contentPreview }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3 min-w-0 flex-1">
                    <h4 class="text-sm font-medium text-red-800 dark:text-red-200">URL is not accessible</h4>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300 break-words">{{ urlTestResult.data?.error || 'Unknown error' }}</p>
                    <ul v-if="urlTestResult.data?.suggestions" class="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                      <li v-for="suggestion in urlTestResult.data.suggestions" :key="suggestion" class="break-words">{{ suggestion }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Website Input -->
          <div v-if="showWebsiteInput" class="mt-4 space-y-4">
            <div class="space-y-3">
              <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input
                  v-model="websiteInput"
                  type="url"
                  placeholder="https://example.com"
                  class="input-field flex-1 min-w-0"
                  :disabled="websiteTesting || websiteAdding"
                  @keyup.enter="testWebsiteBeforeAdd"
                />
                <div class="flex space-x-2">
                  <button
                    type="button"
                    @click="testWebsiteBeforeAdd"
                    :disabled="!websiteInput.trim() || websiteTesting || websiteAdding"
                    class="btn-secondary text-sm whitespace-nowrap"
                  >
                    <span v-if="websiteTesting">Testing...</span>
                    <span v-else>Test</span>
                  </button>
                  <button
                    type="button"
                    @click="addContextWebsite"
                    :disabled="!websiteInput.trim() || websiteTesting || websiteAdding || !websiteTestResult?.success"
                    class="btn-primary text-sm whitespace-nowrap"
                  >
                    <span v-if="websiteAdding">Crawling...</span>
                    <span v-else>Crawl Website</span>
                  </button>
                </div>
              </div>

              <!-- Crawling Progress Display -->
              <div v-if="crawlingProgress.isActive" class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-3">
                  Crawling Progress
                </h4>
                
                <!-- Progress Bar -->
                <div class="mb-3">
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-xs text-blue-700 dark:text-blue-300">
                      {{ crawlingProgress.message }}
                    </span>
                    <span class="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {{ crawlingProgress.percentage }}%
                    </span>
                  </div>
                  <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div 
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      :style="{ width: `${crawlingProgress.percentage}%` }"
                    ></div>
                  </div>
                </div>
                
                <!-- Status Details -->
                <div class="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span class="font-medium text-blue-900 dark:text-blue-200">Phase:</span>
                    <span class="text-blue-700 dark:text-blue-300 ml-1 capitalize">{{ crawlingProgress.phase }}</span>
                  </div>
                  <div>
                    <span class="font-medium text-blue-900 dark:text-blue-200">Pages:</span>
                    <span class="text-blue-700 dark:text-blue-300 ml-1">
                      {{ crawlingProgress.currentPage }}/{{ crawlingProgress.totalPages }}
                    </span>
                  </div>
                </div>
                
                <!-- Current URL being crawled -->
                <div v-if="crawlingProgress.currentUrl && crawlingProgress.phase === 'crawling'" class="mt-2 text-xs">
                  <span class="font-medium text-blue-900 dark:text-blue-200">Current URL:</span>
                  <span class="text-blue-700 dark:text-blue-300 ml-1 break-all">{{ crawlingProgress.currentUrl }}</span>
                </div>
              </div>

              <!-- Crawl Options -->
              <div v-if="websiteTestResult?.success" class="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-3 overflow-hidden">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white">Crawl Options</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Pages
                    </label>
                    <input
                      v-model.number="crawlOptions.maxPages"
                      type="number"
                      min="1"
                      max="200"
                      class="input-field text-sm"
                    />
                    <p class="text-xs text-gray-500 mt-1">Maximum pages to crawl (1-200)</p>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Depth
                    </label>
                    <input
                      v-model.number="crawlOptions.maxDepth"
                      type="number"
                      min="1"
                      max="3"
                      class="input-field text-sm"
                    />
                    <p class="text-xs text-gray-500 mt-1">How deep to follow links (1-3)</p>
                  </div>
                  <div class="sm:col-span-2 lg:col-span-1">
                    <label class="flex items-center space-x-2">
                      <input
                        v-model="crawlOptions.sameDomainOnly"
                        type="checkbox"
                        class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Same domain only</span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1">Only crawl pages on the same domain</p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Website Test Results -->
            <div v-if="websiteTestResult" class="text-left overflow-hidden">
              <div v-if="websiteTestResult.success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3 min-w-0 flex-1">
                    <h4 class="text-sm font-medium text-green-800 dark:text-green-200">Website is accessible for crawling</h4>
                    <div class="mt-1 text-sm text-green-700 dark:text-green-300">
                      <p>Estimated pages: {{ websiteTestResult.data?.estimatedPages || 'Unknown' }}</p>
                      <p>Robots.txt: {{ websiteTestResult.data?.robotsAllowed ? 'Allows crawling' : 'Restricts crawling' }}</p>
                      <p v-if="websiteTestResult.data?.estimatedProcessingTime" class="break-words">{{ websiteTestResult.data.estimatedProcessingTime }}</p>
                      <div v-if="websiteTestResult.data?.sampleLinks?.length" class="mt-2">
                        <p class="text-xs font-medium">Sample pages found:</p>
                        <ul class="text-xs list-disc list-inside ml-2 space-y-1">
                          <li v-for="link in websiteTestResult.data.sampleLinks.slice(0, 3)" :key="link" class="break-all">
                            {{ getUrlPath(link) }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3 min-w-0 flex-1">
                    <h4 class="text-sm font-medium text-red-800 dark:text-red-200">Website is not accessible for crawling</h4>
                    <p class="mt-1 text-sm text-red-700 dark:text-red-300 break-words">{{ websiteTestResult.data?.error || 'Unknown error' }}</p>
                    <ul v-if="websiteTestResult.data?.suggestions" class="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                      <li v-for="suggestion in websiteTestResult.data.suggestions" :key="suggestion" class="break-words">{{ suggestion }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Hidden file input -->
          <input
            ref="fileInput"
            type="file"
            class="sr-only"
            @change="handleFileUpload"
            accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
              Supported file types: PDF, TXT, DOC, DOCX (max 10MB)
            </p>
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
import { DocumentIcon, LinkIcon, ClipboardIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'
import { useToast } from 'vue-toastification'
import RAGSearchUtility from '~/components/Agent/RAGSearchUtility.vue'

// Input sanitization utilities
// These functions provide defense-in-depth against XSS and injection attacks
// by sanitizing all user inputs before processing or display
const sanitizeText = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Remove HTML tags and encode special characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

const sanitizeNumber = (input) => {
  if (typeof input === 'number') return input
  if (!input || typeof input !== 'string') return 0
  
  const num = parseFloat(input.replace(/[^\d.-]/g, ''))
  return isNaN(num) ? 0 : num
}

const sanitizeUrl = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Basic URL sanitization - remove dangerous protocols and clean
  const cleaned = input.trim()
    .replace(/[<>"']/g, '') // Remove dangerous characters
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/data:/gi, '') // Remove data protocol
    .replace(/vbscript:/gi, '') // Remove vbscript protocol
    .replace(/file:/gi, '') // Remove file protocol
    .replace(/ftp:/gi, '') // Remove ftp protocol
  
  // Only allow http and https protocols
  if (cleaned && !cleaned.match(/^https?:\/\//i)) {
    return cleaned.startsWith('://') ? 'https' + cleaned : 'https://' + cleaned
  }
  
  // Additional validation for potential SSRF prevention
  try {
    const url = new URL(cleaned)
    
    // Block localhost and private IP ranges
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0' ||
        hostname.match(/^10\./) ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) ||
        hostname.match(/^192\.168\./)) {
      return ''
    }
    
    return cleaned
  } catch (error) {
    return ''
  }
}

const sanitizeFilename = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // Remove path traversal attempts and dangerous characters
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove dangerous filename characters
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/^\.+/, '') // Remove leading dots
    .trim()
    .substring(0, 255) // Limit length
}

const sanitizePrompt = (input) => {
  if (!input || typeof input !== 'string') return ''
  
  // For prompts, we want to preserve most formatting but remove dangerous content
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object[^>]*>.*?<\/object>/gi, '') // Remove object tags
    .replace(/<embed[^>]*>/gi, '') // Remove embed tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
}

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

// Form state
const form = reactive({
  name: sanitizeText(props.agent?.name || ''),
  description: sanitizeText(props.agent?.description || ''),
  prompt: sanitizePrompt(props.agent?.prompt || ''),
  settings: {
    temperature: sanitizeNumber(props.agent?.settings?.temperature || 0.3),
    maxTokens: sanitizeNumber(props.agent?.settings?.maxTokens || 500),
    responseDelay: sanitizeNumber(props.agent?.settings?.responseDelay || 0),
    connectionId: sanitizeText(props.agent?.settings?.connectionId || ''),
    modelId: sanitizeText(props.agent?.settings?.modelId || ''),
    chatwootApiKey: sanitizeText(props.agent?.settings?.chatwootApiKey || '')
  }
})

const errors = reactive({})
const isSubmitting = ref(false)
const showUrlInput = ref(false)
const showWebsiteInput = ref(false)
const showWebhookUrl = ref(false)
const urlInput = ref('')
const urlTesting = ref(false)
const urlAdding = ref(false)
const urlTestResult = ref(null)
const websiteInput = ref('')
const websiteTesting = ref(false)
const websiteAdding = ref(false)
const websiteTestResult = ref(null)

// File upload state
const fileUploading = ref(false)
const fileUploadProgress = ref(0)

// Context documents state
const contextDocuments = ref([])
const refreshingDocs = ref(new Set())
const deletingDocs = ref(new Set())
const ragSummary = ref(null)
const expandedDocs = reactive({})

// Crawl options
const crawlOptions = reactive({
  maxPages: 50,
  maxDepth: 2,
  sameDomainOnly: true
})

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

// Computed properties for sanitized display values
const sanitizedDisplayValues = computed(() => ({
  name: sanitizeText(form.name),
  description: sanitizeText(form.description),
  prompt: sanitizePrompt(form.prompt),
  urlInput: sanitizeUrl(urlInput.value),
  websiteInput: sanitizeUrl(websiteInput.value)
}))

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
          toast('Failed to load AI connections', { type: 'error' })
  } finally {
    loadingConnections.value = false
  }
}

// Update selected model option based on form settings
const updateSelectedModelOption = () => {
  if (form.settings.connectionId && form.settings.modelId) {
    selectedModelOption.value = `${form.settings.connectionId}|${form.settings.modelId}`
  } else {
    selectedModelOption.value = ''
  }
}

// Handle model selection change
const onModelChange = () => {
  if (selectedModelOption.value) {
    const [connectionId, modelId] = selectedModelOption.value.split('|')
    form.settings.connectionId = connectionId
    form.settings.modelId = modelId
  } else {
    form.settings.connectionId = ''
    form.settings.modelId = ''
  }
}

// Initialize AI connections on mount
onMounted(() => {
  loadAIConnections()
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

// Watch for prop changes (when editing)
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = sanitizeText(newAgent.name || '')
    form.description = sanitizeText(newAgent.description || '')
    form.prompt = sanitizePrompt(newAgent.prompt || '')
    form.settings = {
      temperature: sanitizeNumber(newAgent.settings?.temperature || 0.3),
      maxTokens: sanitizeNumber(newAgent.settings?.maxTokens || 500),
      responseDelay: sanitizeNumber(newAgent.settings?.responseDelay || 0),
      connectionId: sanitizeText(newAgent.settings?.connectionId || ''),
      modelId: sanitizeText(newAgent.settings?.modelId || ''),
      chatwootApiKey: sanitizeText(newAgent.settings?.chatwootApiKey || '')
    }
    
    // Update selected model option
    updateSelectedModelOption()
    
    // Load context documents from agent prop if editing
    if (newAgent._id && newAgent.contextDocuments) {
      contextDocuments.value = newAgent.contextDocuments || []
      ragSummary.value = newAgent.ragSummary || null
    }
  }
}, { immediate: true })

// Watch for available connections to update selected model option
watch(() => availableConnections.value, () => {
  updateSelectedModelOption()
})

// Sanitize form inputs as they change
watch(() => form.name, (newValue) => {
  if (newValue !== sanitizeText(newValue)) {
    form.name = sanitizeText(newValue)
  }
})

watch(() => form.description, (newValue) => {
  if (newValue !== sanitizeText(newValue)) {
    form.description = sanitizeText(newValue)
  }
})

watch(() => form.prompt, (newValue) => {
  if (newValue !== sanitizePrompt(newValue)) {
    form.prompt = sanitizePrompt(newValue)
  }
})

watch(() => urlInput.value, (newValue) => {
  if (newValue && newValue !== sanitizeUrl(newValue)) {
    urlInput.value = sanitizeUrl(newValue)
  }
})

watch(() => websiteInput.value, (newValue) => {
  if (newValue && newValue !== sanitizeUrl(newValue)) {
    websiteInput.value = sanitizeUrl(newValue)
  }
})

// Validation
const validateForm = () => {
  const newErrors = {}

  // Sanitize and validate name
  const sanitizedName = sanitizeText(form.name)
  if (!sanitizedName) {
    newErrors.name = 'Agent name is required'
  } else if (sanitizedName.length > 100) {
    newErrors.name = 'Agent name cannot exceed 100 characters'
  } else if (sanitizedName.length < 2) {
    newErrors.name = 'Agent name must be at least 2 characters long'
  }

  // Sanitize and validate prompt
  const sanitizedPrompt = sanitizePrompt(form.prompt)
  if (!sanitizedPrompt) {
    newErrors.prompt = 'System prompt is required'
  } else if (sanitizedPrompt.length < 10) {
    newErrors.prompt = 'Prompt must be at least 10 characters long'
  } else if (sanitizedPrompt.length > 2000) {
    newErrors.prompt = 'Prompt cannot exceed 2000 characters'
  }

  // Sanitize and validate description
  const sanitizedDescription = sanitizeText(form.description)
  if (sanitizedDescription && sanitizedDescription.length > 500) {
    newErrors.description = 'Description cannot exceed 500 characters'
  }

  // Validate numeric settings
  if (form.settings.temperature < 0 || form.settings.temperature > 1) {
    newErrors.temperature = 'Temperature must be between 0 and 1'
  }

  if (form.settings.maxTokens < 1 || form.settings.maxTokens > 2000) {
    newErrors.maxTokens = 'Max tokens must be between 1 and 2000'
  }

  if (form.settings.responseDelay < 0 || form.settings.responseDelay > 30) {
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
    const agentData = {
      name: sanitizeText(form.name),
      description: sanitizeText(form.description || ''),
      prompt: sanitizePrompt(form.prompt),
      settings: {
        temperature: sanitizeNumber(form.settings.temperature),
        maxTokens: sanitizeNumber(form.settings.maxTokens),
        responseDelay: sanitizeNumber(form.settings.responseDelay),
        connectionId: sanitizeText(form.settings.connectionId) || null,
        modelId: sanitizeText(form.settings.modelId) || null,
        chatwootApiKey: sanitizeText(form.settings.chatwootApiKey) || null
      }
    }

    emit('submit', agentData)
  } finally {
    isSubmitting.value = false
  }
}

// Context document management
const testUrlBeforeAdd = async () => {
  const sanitizedUrl = sanitizeUrl(urlInput.value)
  if (!sanitizedUrl || !props.agent?._id) return
  
  urlTesting.value = true
  urlTestResult.value = null
  
  try {
    const result = await agentsStore.testUrl(props.agent._id, sanitizedUrl)
    urlTestResult.value = result
  } catch (error) {
    console.error('Frontend: URL test failed:', error.message)
    
    // Ensure consistent structure for error cases
    urlTestResult.value = {
      success: false,
      message: 'URL test failed',
      data: { 
        error: error.message || 'Failed to test URL',
        suggestions: [
          'Check if the URL is correct and publicly accessible',
          'Ensure the website allows automated access',
          'Try accessing the URL manually in a browser',
          'Check if the domain requires authentication'
        ]
      }
    }
  } finally {
    urlTesting.value = false
  }
}

const addContextUrl = async () => {
  const sanitizedUrl = sanitizeUrl(urlInput.value)
  if (!sanitizedUrl || !props.agent?._id) return
  
  urlAdding.value = true
  
  try {
    await agentsStore.addContextUrl(props.agent._id, sanitizedUrl)
          toast('URL content added successfully', { type: 'success' })
    urlInput.value = ''
    showUrlInput.value = false
    urlTestResult.value = null
    await reloadAgentData()
  } catch (error) {
    console.error('Failed to add URL:', error.message)
          toast(error.message || 'Failed to add URL content', { type: 'error' })
  } finally {
    urlAdding.value = false
  }
}

const removeContextDocument = async (docId) => {
  if (!props.agent?._id || !docId) {
    return
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
    if (isWebsite) {
      // Try progress version first for websites
      try {
        await agentsStore.refreshContextDocumentWithProgress(
          props.agent._id, 
          docId,
          (progress) => {
            // Update re-crawl progress state
            Object.assign(reCrawlingProgress, {
              phase: progress.phase,
              message: progress.message,
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
        await agentsStore.refreshContextDocument(props.agent._id, docId)
      }
    } else {
      // Use standard refresh for non-website documents
      await agentsStore.refreshContextDocument(props.agent._id, docId)
    }
    
          toast(isWebsite ? 'Website re-crawled successfully' : 'Context document refreshed successfully', { type: 'success' })
    await reloadAgentData()
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
  if (!file || !props.agent?._id) return
  
  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name)
  if (!sanitizedFilename) {
          toast('Invalid filename. Please rename the file and try again.', { type: 'error' })
    event.target.value = ''
    return
  }
  
  // Validate file type
  const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx']
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
    // Create FormData
    const formData = new FormData()
    formData.append('file', file)
    
    // Upload file with progress tracking
    const response = await agentsStore.uploadContext(props.agent._id, file)
    
          toast(`File "${file.name}" uploaded and processed successfully`, { type: 'success' })
    
    // Clear the file input
    event.target.value = ''
    
    // Reload context documents
    await reloadAgentData()
    
  } catch (error) {
    console.error('File upload failed:', error.message)
          toast(error.message || 'Failed to upload file', { type: 'error' })
    event.target.value = '' // Clear the input on error
  } finally {
    fileUploading.value = false
    fileUploadProgress.value = 0
  }
}

// Website management functions
const testWebsiteBeforeAdd = async () => {
  const sanitizedUrl = sanitizeUrl(websiteInput.value)
  if (!sanitizedUrl || !props.agent?._id) return
  
  websiteTesting.value = true
  websiteTestResult.value = null
  
  try {
    // Sanitize crawl options
    const sanitizedCrawlOptions = {
      maxPages: sanitizeNumber(crawlOptions.maxPages),
      maxDepth: sanitizeNumber(crawlOptions.maxDepth),
      sameDomainOnly: Boolean(crawlOptions.sameDomainOnly)
    }
    
    const result = await agentsStore.testWebsite(props.agent._id, sanitizedUrl, sanitizedCrawlOptions)
    websiteTestResult.value = result
  } catch (error) {
    console.error('Frontend: Website test failed:', error.message)
    
    // Ensure consistent structure for error cases
    websiteTestResult.value = {
      success: false,
      message: 'Website test failed',
      data: { 
        error: error.message || 'Failed to test website',
        suggestions: [
          'Check if the URL is correct and publicly accessible',
          'Ensure the website allows automated access',
          'Try accessing the URL manually in a browser',
          'Check if robots.txt allows crawling'
        ]
      }
    }
  } finally {
    websiteTesting.value = false
  }
}

// Add reactive variables for progress tracking
const crawlingProgress = reactive({
  isActive: false,
  phase: '',
  message: '',
  currentPage: 0,
  totalPages: 0,
  percentage: 0,
  currentUrl: ''
})

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

const addContextWebsite = async () => {
  const sanitizedUrl = sanitizeUrl(websiteInput.value)
  if (!sanitizedUrl || !props.agent?._id) return
  
  websiteAdding.value = true
  
  // Sanitize crawl options
  const sanitizedCrawlOptions = {
    maxPages: sanitizeNumber(crawlOptions.maxPages),
    maxDepth: sanitizeNumber(crawlOptions.maxDepth),
    sameDomainOnly: Boolean(crawlOptions.sameDomainOnly)
  }
  
  // Reset progress
  Object.assign(crawlingProgress, {
    isActive: true,
    phase: 'starting',
    message: 'Initializing website crawl...',
    currentPage: 0,
    totalPages: sanitizedCrawlOptions.maxPages,
    percentage: 0,
    currentUrl: ''
  })
  
  try {
    // Try progress version first
    try {
      await agentsStore.addContextWebsiteWithProgress(
        props.agent._id, 
        sanitizedUrl, 
        sanitizedCrawlOptions,
        (progress) => {
          // Update progress state
          Object.assign(crawlingProgress, {
            phase: progress.phase,
            message: progress.message,
            currentPage: progress.currentPage || 0,
            totalPages: progress.totalPages || crawlOptions.maxPages,
            percentage: progress.percentage || 0,
            currentUrl: progress.currentUrl || ''
          })
        }
      )
    } catch (progressError) {
      console.warn('Progress version failed, falling back to standard method:', progressError.message)
      
              // Update progress to show fallback
        Object.assign(crawlingProgress, {
          phase: 'crawling',
          message: 'Crawling website (progress not available)...',
          currentPage: 0,
          totalPages: sanitizedCrawlOptions.maxPages,
          percentage: 50, // Show indeterminate progress
          currentUrl: ''
        })
        
        // Fallback to original method
        await agentsStore.addContextWebsite(props.agent._id, sanitizedUrl, sanitizedCrawlOptions)
    }
    
          toast('Website content added successfully', { type: 'success' })
    websiteInput.value = ''
    showWebsiteInput.value = false
    websiteTestResult.value = null
    await reloadAgentData()
  } catch (error) {
    console.error('Failed to add website:', error.message)
          toast(error.message || 'Failed to add website content', { type: 'error' })
  } finally {
    websiteAdding.value = false
    crawlingProgress.isActive = false
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

const getUrlPath = (url) => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.pathname
  } catch (error) {
    console.error('Failed to parse URL:', error.message)
    return url
  }
}

// Webhook URL functions
const getFullWebhookUrl = (webhookPath) => {
  if (!webhookPath) return 'Not generated'
  
  // Get the current origin (protocol + host + port)
  const origin = window.location.origin
  return `${origin}${webhookPath}`
}

const copyWebhookUrl = async () => {
  if (!props.agent?.webhookUrl) {
          toast('No webhook URL available', { type: 'error' })
    return
  }
  
  try {
    const fullUrl = getFullWebhookUrl(props.agent.webhookUrl)
    await navigator.clipboard.writeText(fullUrl)
          toast('Webhook URL copied to clipboard', { type: 'success' })
  } catch (error) {
    console.error('Failed to copy webhook URL:', error.message)
          toast('Failed to copy webhook URL', { type: 'error' })
  }
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 