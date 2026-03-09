/**
 * GET /api/agents/ai-connections
 *
 * Fetches all active AI connections and the default connection.
 * This endpoint is designed to provide the necessary data for a UI component
 * where a user can select an AI model for an agent.
 * It filters out inactive connections and sensitive information like API keys.
 */
import { sanitizeText, sanitizeUrl, sanitizeErrorMessage } from '~/utils/sanitize'
import settingsService from '~/server/services/settingsService'
import { chatwootAuthMiddleware } from '~/server/utils/auth'

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {

    const connections = await settingsService.getAllAIConnections()
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Filter to only active connections and hide API keys
    const availableConnections = connections
      .filter(conn => conn.isActive)
      .map(conn => ({
        _id: conn._id,
        name: sanitizeText(conn.name),
        provider: sanitizeText(conn.provider),
        endpoint: sanitizeUrl(conn.endpoint),
        availableModels: conn.availableModels?.filter(model => model.enabled) || []
      }))

    return {
      success: true,
      data: {
        connections: availableConnections,
        defaultConnection: defaultConnection ? {
          connectionId: defaultConnection.connection._id,
          modelId: defaultConnection.modelId,
          connectionName: sanitizeText(defaultConnection.connection.name),
          modelName: sanitizeText(defaultConnection.connection.availableModels?.find(m => m.id === defaultConnection.modelId)?.name || defaultConnection.modelId)
        } : null
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch AI connections for agents:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: sanitizeErrorMessage(error)
    })
  }
}) 