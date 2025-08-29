// Import RAG service on server startup to trigger embedding model download
import { ragService } from '~/server/services/ragService'

export default defineNitroPlugin((nitroApp) => {
  console.log('🔄 Initializing RAG service on server startup...')
  
  // The import above will trigger the constructor which starts embedding model download
  // Let's also explicitly call a method to ensure the service is instantiated
  ragService.healthCheck().then((status) => {
    console.log(`📊 RAG service initialized - Qdrant: ${status.qdrantConnected ? '✅' : '❌'}, Embedding Model: ${status.embeddingModelLoaded ? '✅' : '⏳ Loading...'}`)
  }).catch(() => {
    console.log('📊 RAG service initialized with some limitations')
  })
})