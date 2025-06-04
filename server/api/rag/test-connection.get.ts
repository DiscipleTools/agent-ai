import { ragService } from '~/server/services/ragService'

export default defineEventHandler(async (event) => {
  try {
    // Test the RAG system health without authentication
    const healthStatus = await ragService.healthCheck()
    
    return {
      success: true,
      message: 'RAG connection test completed',
      data: {
        qdrantConnected: healthStatus.qdrantConnected,
        embeddingModelLoaded: healthStatus.embeddingModelLoaded,
        error: healthStatus.error
      }
    }
  } catch (error: any) {
    console.error('RAG connection test error:', error)
    
    return {
      success: false,
      message: 'RAG connection test failed',
      data: {
        qdrantConnected: false,
        embeddingModelLoaded: false,
        error: error.message || 'Unknown error'
      }
    }
  }
}) 