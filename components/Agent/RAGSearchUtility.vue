<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center">
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          RAG Search Test
        </h3>
        <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
          Test which context pages are found for a query
        </p>
      </div>
      <button
        type="button"
        @click.prevent="isExpanded = !isExpanded"
        class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
      >
        <svg 
          class="h-4 w-4 transition-transform duration-200" 
          :class="{ 'rotate-180': isExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <div v-if="isExpanded" class="space-y-4">
      <!-- Search Input -->
      <div class="flex space-x-2">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Enter your test query..."
          class="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          :disabled="searching"
          @keyup.enter.prevent="performSearch"
        />
                 <select
           v-model="searchLimit"
           class="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
           :disabled="searching"
         >
           <option value="3">Top 3</option>
           <option value="5">Top 5</option>
           <option value="10">Top 10</option>
           <option value="15">Top 15</option>
         </select>
         <button
           type="button"
           @click.prevent="showFullContent = !showFullContent"
           class="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
           :title="showFullContent ? 'Show chunk previews' : 'Show full chunk content'"
         >
           {{ showFullContent ? 'Preview' : 'Full' }}
         </button>
        <button
          type="button"
          @click.prevent="performSearch"
          :disabled="!searchQuery.trim() || searching"
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="searching" class="flex items-center">
            <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
            Searching...
          </span>
          <span v-else>Search</span>
        </button>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults" class="space-y-3">
        <!-- Results Summary -->
        <div class="flex items-center justify-between text-sm">
          <div class="text-blue-700 dark:text-blue-300">
            <span class="font-medium">{{ searchResults.totalResults }} results</span>
            <span v-if="searchResults.totalChunks > 0" class="text-blue-600 dark:text-blue-400">
              from {{ searchResults.totalChunks }} total chunks
            </span>
          </div>
          <div class="text-xs text-blue-600 dark:text-blue-400">
            Query: "{{ searchResults.query }}"
          </div>
        </div>

        <!-- No Results -->
        <div v-if="searchResults.results.length === 0" class="text-center py-4">
          <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47.881-6.08 2.33l-.147.083A1 1 0 016 18h12a1 1 0 00.227-1.587l-.147-.083A7.962 7.962 0 0112 15z" />
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            No relevant chunks found for this query
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Try different keywords or check if documents are properly indexed
          </p>
        </div>

                 <!-- Document Summary -->
         <div v-if="searchResults.documentSummary && searchResults.documentSummary.length > 0" class="bg-white dark:bg-gray-800 rounded-md p-3 border border-blue-200 dark:border-blue-700">
           <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Documents Found:</h4>
           <div class="space-y-2">
             <div 
               v-for="doc in searchResults.documentSummary" 
               :key="`${doc.title}_${doc.type}`"
               class="border border-gray-200 dark:border-gray-600 rounded p-2"
             >
               <div class="flex items-center justify-between text-xs mb-1">
                 <div class="flex items-center space-x-2 min-w-0 flex-1">
                   <div class="flex-shrink-0">
                     <svg v-if="doc.type === 'file'" class="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                       <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                     </svg>
                     <svg v-else-if="doc.type === 'url'" class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                     </svg>
                     <svg v-else class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-3a5 5 0 00-5-5 5 5 0 00-5 5v3m0 0h10" />
                     </svg>
                   </div>
                   <span class="text-gray-700 dark:text-gray-300 font-medium">{{ doc.title }}</span>
                 </div>
                 <div class="flex items-center space-x-2 flex-shrink-0">
                   <span class="text-gray-500 dark:text-gray-400">{{ doc.chunks }} chunk{{ doc.chunks !== 1 ? 's' : '' }}</span>
                   <span class="text-green-600 dark:text-green-400 font-medium">{{ Math.round(doc.bestScore * 100) }}%</span>
                 </div>
               </div>
               <div v-if="doc.source" class="text-xs text-blue-600 dark:text-blue-400 truncate">
                 {{ doc.source }}
               </div>
             </div>
           </div>
                  </div>

         <!-- Individual Results -->
         <div v-if="searchResults.results.length > 0" class="space-y-2">
           <div class="flex items-center justify-between">
             <h4 class="text-sm font-medium text-gray-900 dark:text-white">Chunks Found:</h4>
             <button
               type="button"
               @click.prevent="groupByPage = !groupByPage"
               class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
             >
               {{ groupByPage ? 'Show All' : 'Group by Page' }}
             </button>
           </div>
           <div class="space-y-2 max-h-96 overflow-y-auto">
             <!-- Grouped by Page View -->
             <template v-if="groupByPage">
               <div 
                 v-for="(chunks, source) in groupedResults" 
                 :key="source"
                 class="border border-gray-300 dark:border-gray-600 rounded-md"
               >
                 <div class="bg-gray-50 dark:bg-gray-700 px-3 py-2 border-b border-gray-300 dark:border-gray-600">
                   <div class="text-sm font-medium text-gray-900 dark:text-white">
                     {{ source }}
                   </div>
                   <div class="text-xs text-gray-500 dark:text-gray-400">
                     {{ chunks.length }} chunk{{ chunks.length !== 1 ? 's' : '' }} found
                   </div>
                 </div>
                 <div class="p-2 space-y-2">
                   <div 
                     v-for="result in chunks" 
                     :key="result.id"
                     class="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-700"
                   >
                     <div class="flex items-start justify-between mb-2">
                       <div class="flex items-center space-x-2 min-w-0 flex-1">
                         <span class="flex-shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">
                           #{{ result.rank }}
                         </span>
                         <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                           {{ result.documentTitle }}
                         </span>
                         <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                           chunk {{ result.chunkIndex }}
                         </span>
                       </div>
                       <div class="flex items-center space-x-2 flex-shrink-0">
                         <span 
                           class="text-xs font-medium px-2 py-1 rounded"
                           :class="result.relevancePercentage >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  result.relevancePercentage >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'"
                         >
                           {{ result.relevancePercentage }}%
                         </span>
                       </div>
                     </div>
                     <div class="text-xs text-gray-600 dark:text-gray-400">
                       <p v-if="!showFullContent" class="line-clamp-3">
                         {{ result.text }}
                       </p>
                       <div v-else class="max-h-64 overflow-y-auto">
                         <pre class="whitespace-pre-wrap font-sans">{{ result.text }}</pre>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </template>
             
             <!-- Regular View -->
             <template v-else>
               <div 
                 v-for="result in searchResults.results" 
                 :key="result.id"
                 class="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-700"
               >
                 <div class="flex items-start justify-between mb-2">
                   <div class="flex items-center space-x-2 min-w-0 flex-1">
                     <span class="flex-shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">
                       #{{ result.rank }}
                     </span>
                     <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                       {{ result.documentTitle }}
                     </span>
                     <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                       chunk {{ result.chunkIndex }}
                     </span>
                   </div>
                   <div class="flex items-center space-x-2 flex-shrink-0">
                     <span 
                       class="text-xs font-medium px-2 py-1 rounded"
                       :class="result.relevancePercentage >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              result.relevancePercentage >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'"
                     >
                       {{ result.relevancePercentage }}%
                     </span>
                   </div>
                 </div>
                 <div class="text-xs text-gray-600 dark:text-gray-400">
                   <p v-if="!showFullContent" class="line-clamp-3">
                     {{ result.text }}
                   </p>
                   <div v-else class="max-h-64 overflow-y-auto">
                     <pre class="whitespace-pre-wrap font-sans">{{ result.text }}</pre>
                   </div>
                 </div>
                 <div v-if="result.source" class="mt-2 text-xs text-blue-600 dark:text-blue-400 truncate">
                   Source: {{ result.source }}
                 </div>
               </div>
             </template>
           </div>
         </div>
       </div>

      <!-- Error State -->
      <div v-if="searchError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
        <div class="flex items-center">
          <svg class="h-4 w-4 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm text-red-700 dark:text-red-300">{{ searchError }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAgentsStore } from '~/stores/agents'

const props = defineProps({
  agentId: {
    type: String,
    required: true
  }
})

const agentsStore = useAgentsStore()
const toast = useToast()

// Component state
const isExpanded = ref(false)
const searchQuery = ref('')
const searchLimit = ref(5)
const showFullContent = ref(false)
const groupByPage = ref(false)
const searching = ref(false)
const searchResults = ref(null)
const searchError = ref(null)

const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  searching.value = true
  searchError.value = null
  searchResults.value = null

  try {
    const result = await agentsStore.searchRAG(
      props.agentId, 
      searchQuery.value.trim(), 
      parseInt(searchLimit.value)
    )
    
    searchResults.value = result
    
    if (result.results.length === 0) {
      toast.info(`No results found for "${searchQuery.value.trim()}"`)
    } else {
      toast.success(`Found ${result.results.length} relevant chunks`)
    }
  } catch (error) {
    console.error('RAG search failed:', error)
    searchError.value = error.message || 'Search failed'
    toast.error(error.message || 'Search failed')
  } finally {
    searching.value = false
  }
}

// Group results by source page for better organization
const groupedResults = computed(() => {
  if (!searchResults.value?.results) return {}
  
  return searchResults.value.results.reduce((groups, result) => {
    const source = result.source || 'Unknown Source'
    if (!groups[source]) {
      groups[source] = []
    }
    groups[source].push(result)
    return groups
  }, {})
})

// Clear results when query changes
watch(searchQuery, () => {
  searchResults.value = null
  searchError.value = null
})
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 