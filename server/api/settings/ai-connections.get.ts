/**
 * Fetches all AI connections and the default AI connection.
 * GET /api/settings/ai-connections
 */
import settingsService from '~/server/services/settingsService'
import { authMiddleware } from '~/server/utils/auth'
import { sanitizeText, sanitizeObjectId, sanitizeModelId, sanitizeUrl } from '~/utils/sanitize'

export default authMiddleware.admin(async (event, checker) => {
  try {

    const connections = await settingsService.getAllAIConnections()
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Don't send sensitive API keys - properly serialize Mongoose documents
    const safeConnections = connections.map(conn => {
      // Convert Mongoose document to plain object if needed
      const plainConn = (conn as any).toObject ? (conn as any).toObject() : conn
      
      const sanitizedModels = (plainConn.availableModels || []).map((model: any) => ({
        ...model,
        id: sanitizeModelId(model.id),
        name: sanitizeText(model.name)
      }))

      return {
        _id: sanitizeObjectId(plainConn._id.toString()),
        name: sanitizeText(plainConn.name),
        provider: sanitizeText(plainConn.provider),
        endpoint: sanitizeUrl(plainConn.endpoint),
        availableModels: sanitizedModels,
        isActive: plainConn.isActive,
        apiKey: '***HIDDEN***'
      }
    })

    return {
      success: true,
      data: {
        connections: safeConnections,
        defaultConnection: defaultConnection ? {
          connectionId: sanitizeObjectId(defaultConnection.connection._id.toString()),
          modelId: sanitizeModelId(defaultConnection.modelId)
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