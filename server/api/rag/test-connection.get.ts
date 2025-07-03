/**
 * @description Test the connection to the RAG system.
 * @route GET /api/rag/test-connection
 */
import { ragService } from '~/server/services/ragService'
import { sanitizeErrorMessage } from '~/utils/sanitize.js'

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
        error: healthStatus.error ? sanitizeErrorMessage(healthStatus.error) : undefined
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
        error: sanitizeErrorMessage(error)
      }
    }
  }
}) 