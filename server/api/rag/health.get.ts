/**
 * @description Checks the health of the RAG system.
 * @endpoint GET /api/rag/health
 */
import { ragService } from '~/server/services/ragService'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import { sanitizeErrorMessage, sanitizeInternalUrl } from '~/utils/sanitize.js'

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {

    // Check RAG system health
    const healthStatus = await ragService.healthCheck()

    return {
      success: true,
      message: 'RAG health check completed',
      data: {
        qdrant: {
          connected: healthStatus.qdrantConnected,
          url: sanitizeInternalUrl(process.env.QDRANT_URL || 'http://localhost:6333')
        },
        embeddings: {
          modelLoaded: healthStatus.embeddingModelLoaded,
          modelName: 'Xenova/all-MiniLM-L12-v2'
        },
        error: healthStatus.error ? sanitizeErrorMessage(healthStatus.error) : null,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error: any) {
    console.error('RAG health check error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: sanitizeErrorMessage(error)
    })
  }
}) 