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
          class="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
        >
          <div class="flex items-start space-x-3 flex-1 min-w-0">
            <div class="flex-shrink-0 mt-0.5">
              <DocumentIcon v-if="doc.type === 'file'" class="h-5 w-5 text-gray-400" />
              <LinkIcon v-else-if="doc.type === 'url'" class="h-5 w-5 text-gray-400" />
              <svg v-else-if="doc.type === 'website'" class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-3a5 5 0 00-5-5 5 5 0 00-5 5v3m0 0h10" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ doc.filename || doc.url }}
                <span v-if="doc.type === 'website' && doc.metadata?.totalPages" class="font-normal text-gray-500">
                  ({{ doc.metadata.totalPages }} pages)
                </span>
              </p>
              <div class="flex items-center space-x-2 text-xs text-gray-500 break-words">
                <span>{{ doc.type === 'file' ? 'File' : doc.type === 'url' ? 'URL' : 'Website' }}</span>
                <span>•</span>
                <span>{{ formatDate(doc.uploadedAt) }}</span>
                <span>•</span>
                <span>{{ formatContentLength(doc.contentLength) }}</span>
                <span>•</span>
                <div class="flex items-center space-x-1">
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
              <p v-if="doc.contentPreview" class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {{ doc.contentPreview }}
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 ml-3 flex-shrink-0">
            <button
              type="button"
              @click="viewContextDocument(doc._id)"
              class="text-blue-600 hover:text-blue-700 text-sm whitespace-nowrap"
              title="View content"
            >
              View
            </button>
            <button
              v-if="doc.type === 'url' || doc.type === 'website'"
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
      </div>
      
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
import { DocumentIcon, LinkIcon } from '@heroicons/vue/24/outline'
import { useAgentsStore } from '~/stores/agents'

const props = defineProps({
  agent: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['submit', 'cancel'])

// Stores
const agentsStore = useAgentsStore()
const toast = useToast()

// Form state
const form = reactive({
  name: props.agent?.name || '',
  description: props.agent?.description || '',
  prompt: props.agent?.prompt || '',
  settings: {
    temperature: props.agent?.settings?.temperature || 0.3,
    maxTokens: props.agent?.settings?.maxTokens || 500,
    responseDelay: props.agent?.settings?.responseDelay || 0,
    connectionId: props.agent?.settings?.connectionId || '',
    modelId: props.agent?.settings?.modelId || ''
  }
})

const errors = reactive({})
const isSubmitting = ref(false)
const showUrlInput = ref(false)
const showWebsiteInput = ref(false)
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
        connectionId: connection._id,
        connectionName: connection.name,
        modelId: model.id,
        modelName: model.name || model.id,
        provider: connection.provider
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
    console.error('Failed to load AI connections:', error)
    toast.error('Failed to load AI connections')
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

// Load context documents function (defined before watcher)
const loadContextDocuments = async () => {
  if (!props.agent?._id) return
  
  try {
    const response = await agentsStore.fetchContextDocuments(props.agent._id)
    contextDocuments.value = response.contextDocuments || []
    ragSummary.value = response.ragSummary || null
  } catch (error) {
    console.error('Failed to load context documents:', error)
    toast.error('Failed to load context documents')
  }
}

// Watch for prop changes (when editing)
watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    form.name = newAgent.name || ''
    form.description = newAgent.description || ''
    form.prompt = newAgent.prompt || ''
    form.settings = {
      temperature: newAgent.settings?.temperature || 0.3,
      maxTokens: newAgent.settings?.maxTokens || 500,
      responseDelay: newAgent.settings?.responseDelay || 0,
      connectionId: newAgent.settings?.connectionId || '',
      modelId: newAgent.settings?.modelId || ''
    }
    
    // Update selected model option
    updateSelectedModelOption()
    
    // Load context documents if editing
    if (newAgent._id) {
      loadContextDocuments()
    }
  }
}, { immediate: true })

// Watch for available connections to update selected model option
watch(() => availableConnections.value, () => {
  updateSelectedModelOption()
})

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
        responseDelay: Number(form.settings.responseDelay),
        connectionId: form.settings.connectionId || null,
        modelId: form.settings.modelId || null
      }
    }

    emit('submit', agentData)
  } finally {
    isSubmitting.value = false
  }
}

// Context document management
const testUrlBeforeAdd = async () => {
  if (!urlInput.value.trim() || !props.agent?._id) return
  
  urlTesting.value = true
  urlTestResult.value = null
  
  try {
    const result = await agentsStore.testUrl(props.agent._id, urlInput.value.trim())
    urlTestResult.value = result
  } catch (error) {
    console.error('Frontend: URL test failed with error:', error)
    console.error('Frontend: Error details:', {
      message: error.message,
      data: error.data,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      stack: error.stack
    })
    
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
  if (!urlInput.value.trim() || !props.agent?._id) return
  
  urlAdding.value = true
  
  try {
    await agentsStore.addContextUrl(props.agent._id, urlInput.value.trim())
    toast.success('URL content added successfully')
    urlInput.value = ''
    showUrlInput.value = false
    urlTestResult.value = null
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to add URL:', error)
    toast.error(error.message || 'Failed to add URL content')
  } finally {
    urlAdding.value = false
  }
}

const removeContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  deletingDocs.value.add(docId)
  
  try {
    await agentsStore.deleteContextDocument(props.agent._id, docId)
    toast.success('Context document removed successfully')
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to remove document:', error)
    toast.error(error.message || 'Failed to remove context document')
  } finally {
    deletingDocs.value.delete(docId)
  }
}

const refreshContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  refreshingDocs.value.add(docId)
  
  try {
    await agentsStore.refreshContextDocument(props.agent._id, docId)
    toast.success('Context document refreshed successfully')
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to refresh document:', error)
    toast.error(error.message || 'Failed to refresh context document')
  } finally {
    refreshingDocs.value.delete(docId)
  }
}

const viewContextDocument = async (docId) => {
  if (!props.agent?._id) return
  
  try {
    const response = await agentsStore.getContextDocument(props.agent._id, docId)
    // TODO: Open modal or navigate to view page
    toast.info('Document viewing not yet implemented')
  } catch (error) {
    console.error('Failed to get document:', error)
    toast.error(error.message || 'Failed to get context document')
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !props.agent?._id) return
  
  // Validate file type
  const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx']
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    toast.error('File type not supported. Please upload PDF, TXT, DOC, or DOCX files.')
    event.target.value = '' // Clear the input
    return
  }
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    toast.error('File size too large. Maximum allowed size is 10MB.')
    event.target.value = '' // Clear the input
    return
  }
  
  fileUploading.value = true
  fileUploadProgress.value = 0
  
  try {
    console.log(`Uploading file: ${file.name} (${file.size} bytes, ${file.type})`)
    
    // Create FormData
    const formData = new FormData()
    formData.append('file', file)
    
    // Upload file with progress tracking
    const response = await agentsStore.uploadContext(props.agent._id, file)
    
    toast.success(`File "${file.name}" uploaded and processed successfully`)
    
    // Clear the file input
    event.target.value = ''
    
    // Reload context documents
    await loadContextDocuments()
    
  } catch (error) {
    console.error('File upload failed:', error)
    toast.error(error.message || 'Failed to upload file')
    event.target.value = '' // Clear the input on error
  } finally {
    fileUploading.value = false
    fileUploadProgress.value = 0
  }
}

// Website management functions
const testWebsiteBeforeAdd = async () => {
  if (!websiteInput.value.trim() || !props.agent?._id) return
  
  websiteTesting.value = true
  websiteTestResult.value = null
  
  try {
    const result = await agentsStore.testWebsite(props.agent._id, websiteInput.value.trim(), crawlOptions)
    websiteTestResult.value = result
  } catch (error) {
    console.error('Frontend: Website test failed with error:', error)
    console.error('Frontend: Error details:', {
      message: error.message,
      data: error.data,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      stack: error.stack
    })
    
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

const addContextWebsite = async () => {
  if (!websiteInput.value.trim() || !props.agent?._id) return
  
  websiteAdding.value = true
  
  // Reset progress
  Object.assign(crawlingProgress, {
    isActive: true,
    phase: 'starting',
    message: 'Initializing website crawl...',
    currentPage: 0,
    totalPages: crawlOptions.maxPages,
    percentage: 0,
    currentUrl: ''
  })
  
  try {
    // Try progress version first
    try {
      await agentsStore.addContextWebsiteWithProgress(
        props.agent._id, 
        websiteInput.value.trim(), 
        crawlOptions,
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
      console.warn('Progress version failed, falling back to standard method:', progressError)
      
      // Update progress to show fallback
      Object.assign(crawlingProgress, {
        phase: 'crawling',
        message: 'Crawling website (progress not available)...',
        currentPage: 0,
        totalPages: crawlOptions.maxPages,
        percentage: 50, // Show indeterminate progress
        currentUrl: ''
      })
      
      // Fallback to original method
      await agentsStore.addContextWebsite(props.agent._id, websiteInput.value.trim(), crawlOptions)
    }
    
    toast.success('Website content added successfully')
    websiteInput.value = ''
    showWebsiteInput.value = false
    websiteTestResult.value = null
    await loadContextDocuments()
  } catch (error) {
    console.error('Failed to add website:', error)
    toast.error(error.message || 'Failed to add website content')
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
    console.error('Failed to parse URL:', error)
    return url
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