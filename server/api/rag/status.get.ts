import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication
    await requireAuth(event)

    // Check if Qdrant is available
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333'
    
    try {
      const response = await fetch(`${qdrantUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      })
      
      const isConnected = response.ok
      
      return {
        success: true,
        data: {
          qdrant: {
            connected: isConnected,
            url: qdrantUrl,
            status: isConnected ? 'connected' : 'unreachable'
          },
          ragEnabled: isConnected,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error: any) {
      return {
        success: true,
        data: {
          qdrant: {
            connected: false,
            url: qdrantUrl,
            status: 'disconnected',
            error: error.message
          },
          ragEnabled: false,
          timestamp: new Date().toISOString()
        }
      }
    }

  } catch (error: any) {
    console.error('RAG status check error:', error)
    
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'RAG status check failed'
    })
  }
}) 