import { ragService } from '~/server/services/ragService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication
    const user = await requireAuth(event)
    
    // Only allow admin users to check RAG health
    if (user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied. Admin privileges required.'
      })
    }

    // Check RAG system health
    const healthStatus = await ragService.healthCheck()

    return {
      success: true,
      message: 'RAG health check completed',
      data: {
        qdrant: {
          connected: healthStatus.qdrantConnected,
          url: process.env.QDRANT_URL || 'http://localhost:6333'
        },
        embeddings: {
          modelLoaded: healthStatus.embeddingModelLoaded,
          modelName: 'Xenova/all-MiniLM-L12-v2'
        },
        error: healthStatus.error || null,
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
      statusMessage: error.message || 'RAG health check failed'
    })
  }
}) 