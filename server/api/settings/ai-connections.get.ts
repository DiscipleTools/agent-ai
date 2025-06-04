import settingsService from '~/server/services/settingsService'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const connections = await settingsService.getAllAIConnections()
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Don't send sensitive API keys
    const safeConnections = connections.map(conn => ({
      ...conn,
      apiKey: '***HIDDEN***'
    }))

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