import settingsService from '~/server/services/settingsService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireAuth(event)

    const connections = await settingsService.getAllAIConnections()
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Filter to only active connections and hide API keys
    const availableConnections = connections
      .filter(conn => conn.isActive)
      .map(conn => ({
        _id: conn._id,
        name: conn.name,
        provider: conn.provider,
        endpoint: conn.endpoint,
        availableModels: conn.availableModels?.filter(model => model.enabled) || []
      }))

    return {
      success: true,
      data: {
        connections: availableConnections,
        defaultConnection: defaultConnection ? {
          connectionId: defaultConnection.connection._id,
          modelId: defaultConnection.modelId,
          connectionName: defaultConnection.connection.name,
          modelName: defaultConnection.connection.availableModels?.find(m => m.id === defaultConnection.modelId)?.name || defaultConnection.modelId
        } : null
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch AI connections for agents:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch AI connections'
    })
  }
}) 