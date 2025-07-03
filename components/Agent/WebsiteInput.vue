<template>
  <div class="mt-4 space-y-4">
    <div class="space-y-3">
      <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <input
          v-model="websiteInput"
          type="url"
          placeholder="https://example.com"
          class="input-field flex-1 min-w-0"
          :disabled="websiteTesting || websiteAdding"
          @keyup.enter="testWebsite"
        />
        <div class="flex space-x-2">
          <button
            type="button"
            @click="testWebsite"
            :disabled="!websiteInput.trim() || websiteTesting || websiteAdding"
            class="btn-secondary text-sm whitespace-nowrap"
          >
            <span v-if="websiteTesting">Testing...</span>
            <span v-else>Test</span>
          </button>
          <button
            type="button"
            @click="addWebsite"
            :disabled="!websiteInput.trim() || websiteTesting || websiteAdding || !websiteTestResult?.success"
            class="btn-primary text-sm whitespace-nowrap"
          >
            <span v-if="websiteAdding">Crawling...</span>
            <span v-else>Crawl Website</span>
          </button>
          <button
            type="button"
            @click="$emit('close')"
            class="btn-secondary text-sm whitespace-nowrap"
          >
            Cancel
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
</template>

<script setup>
import { useAgentsStore } from '~/stores/agents'
import { sanitizeUrl, sanitizeText, sanitizeNumber } from '~/utils/sanitize'

const props = defineProps({
  agentId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['add-website', 'close'])

const agentsStore = useAgentsStore()

const websiteInput = ref('')
const websiteTesting = ref(false)
const websiteAdding = ref(false)
const websiteTestResult = ref(null)

// Crawl options
const crawlOptions = reactive({
  maxPages: 50,
  maxDepth: 2,
  sameDomainOnly: true
})

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

// Watch for sanitization
watch(() => websiteInput.value, (newValue) => {
  if (newValue && newValue !== sanitizeUrl(newValue)) {
    websiteInput.value = sanitizeUrl(newValue)
  }
})

const testWebsite = async () => {
  const sanitizedUrl = sanitizeUrl(websiteInput.value)
  if (!sanitizedUrl || !props.agentId) return
  
  websiteTesting.value = true
  websiteTestResult.value = null
  
  try {
    // Sanitize crawl options
    const sanitizedCrawlOptions = {
      maxPages: Math.min(Math.max(sanitizeNumber(crawlOptions.maxPages), 1), 200),
      maxDepth: Math.min(Math.max(sanitizeNumber(crawlOptions.maxDepth), 1), 5),
      sameDomainOnly: Boolean(crawlOptions.sameDomainOnly)
    }
    
    const result = await agentsStore.testWebsite(props.agentId, sanitizedUrl, sanitizedCrawlOptions)
    websiteTestResult.value = result
  } catch (error) {
    console.error('Frontend: Website test failed:', error.message)
    
    // Ensure consistent structure for error cases
    websiteTestResult.value = {
      success: false,
      message: 'Website test failed',
      data: { 
        error: sanitizeText(error.message || 'Failed to test website'),
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

const addWebsite = async () => {
  const sanitizedUrl = sanitizeUrl(websiteInput.value)
  if (!sanitizedUrl) return
  
  websiteAdding.value = true
  
  // Sanitize crawl options
  const sanitizedCrawlOptions = {
    maxPages: Math.min(Math.max(sanitizeNumber(crawlOptions.maxPages), 1), 200),
    maxDepth: Math.min(Math.max(sanitizeNumber(crawlOptions.maxDepth), 1), 5),
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
    const progressCallback = (progress) => {
      // Update progress state
      Object.assign(crawlingProgress, {
        phase: sanitizeText(progress.phase || ''),
        message: sanitizeText(progress.message || ''),
        currentPage: sanitizeNumber(progress.currentPage || 0),
        totalPages: sanitizeNumber(progress.totalPages || crawlOptions.maxPages),
        percentage: sanitizeNumber(progress.percentage || 0),
        currentUrl: sanitizeUrl(progress.currentUrl || '')
      })
      
      // Turn off progress when crawling is complete
      if (progress.type === 'complete' || progress.type === 'error') {
        websiteAdding.value = false
        crawlingProgress.isActive = false
        
        // Reset form and close modal when done
        websiteInput.value = ''
        websiteTestResult.value = null
        emit('close')
      }
    }
    
    emit('add-website', { url: sanitizedUrl, options: sanitizedCrawlOptions, progressCallback })
    
    // Don't close immediately - wait for crawling to complete
    // The progressCallback will handle closing when done
  } catch (error) {
    console.error('Failed to add website:', error.message)
    websiteAdding.value = false
    crawlingProgress.isActive = false
  }
}

const getUrlPath = (url) => {
  try {
    const parsedUrl = new URL(sanitizeUrl(url))
    // Don't use sanitizeText on pathname as it encodes forward slashes
    return parsedUrl.pathname || '/'
  } catch (error) {
    console.error('Failed to parse URL:', error.message)
    // For display purposes, just return the original URL without over-sanitization
    return url || ''
  }
}
</script>

 