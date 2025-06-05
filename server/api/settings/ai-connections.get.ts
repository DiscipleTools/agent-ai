import settingsService from '~/server/services/settingsService'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const connections = await settingsService.getAllAIConnections()
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Don't send sensitive API keys - properly serialize Mongoose documents
    const safeConnections = connections.map(conn => {
      // Convert Mongoose document to plain object if needed
      const plainConn = (conn as any).toObject ? (conn as any).toObject() : conn
      
      return {
        _id: plainConn._id,
        name: plainConn.name,
        provider: plainConn.provider,
        endpoint: plainConn.endpoint,
        availableModels: plainConn.availableModels || [],
        isActive: plainConn.isActive,
        apiKey: '***HIDDEN***'
      }
    })

    return {
      success: true,
      data: {
        connections: safeConnections,
        defaultConnection: defaultConnection ? {
          connectionId: defaultConnection.connection._id,
          modelId: defaultConnection.modelId
        } : null
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch AI connections:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch AI connections'
    })
  }
}) 