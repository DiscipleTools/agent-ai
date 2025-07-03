/**
 * @description Deletes an AI connection by its ID.
 * @endpoint DELETE /api/settings/ai-connections/:id
 */
import settingsService from '~/server/services/settingsService'
import { authMiddleware } from '~/server/utils/auth'
import { sanitizeObjectId, sanitizeText } from '~/utils/sanitize'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
    const connectionId = sanitizeObjectId(getRouterParam(event, 'id'))

    if (!connectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A valid Connection ID is required'
      })
    }

    // Get current settings
    const settings = await settingsService.getAllSettings()
    if (!settings) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to load settings'
      })
    }

    // Find connection to delete
    const connectionIndex = settings.aiConnections?.findIndex(
      (conn: any) => conn._id.toString() === connectionId
    )

    if (connectionIndex === -1 || connectionIndex === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: 'AI connection not found'
      })
    }

    // Prevent deletion if this is the only connection
    if (settings.aiConnections.length === 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete the last AI connection. Please add another connection first.'
      })
    }

    // Remove the connection
    const deletedConnection = settings.aiConnections[connectionIndex]
    settings.aiConnections.splice(connectionIndex, 1)

    // If this was the default connection, set a new default
    if (settings.defaultConnection?.connectionId?.toString() === connectionId) {
      const newDefaultConnection = settings.aiConnections.find((conn: any) => conn.isActive)
      if (newDefaultConnection && newDefaultConnection.availableModels?.length) {
        settings.defaultConnection = {
          connectionId: newDefaultConnection._id,
          modelId: newDefaultConnection.availableModels.find((m: any) => m.enabled)?.id || 
                   newDefaultConnection.availableModels[0]?.id
        }
      } else {
        settings.defaultConnection = null
      }
    }

    // Update settings
    await settingsService.updateSettings({
      aiConnections: settings.aiConnections,
      defaultConnection: settings.defaultConnection
    }, user._id)

    const sanitizedName = sanitizeText(deletedConnection.name)
    return {
      success: true,
      message: `AI connection "${sanitizedName}" deleted successfully`
    }
  } catch (error: any) {
    console.error('Failed to delete AI connection:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to delete AI connection'
    })
  }
}) 