/**
 * @description Refreshes the available models for a specific AI connection.
 * @route POST /api/settings/ai-connections/:id/refresh-models
 */
import settingsService from '~/server/services/settingsService'
import aiService from '~/server/services/aiService'
import { authMiddleware } from '~/server/utils/auth'
import { sanitizeObjectId } from '~/utils/sanitize'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
    const rawConnectionId = getRouterParam(event, 'id')
    const connectionId = sanitizeObjectId(rawConnectionId)

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

    // Find connection to refresh
    const connectionIndex = settings.aiConnections?.findIndex(
      (conn: any) => conn._id.toString() === connectionId
    )

    if (connectionIndex === -1 || connectionIndex === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: 'AI connection not found'
      })
    }

    const connection = settings.aiConnections[connectionIndex]

    // Fetch latest models from the API
    try {
      const models = await aiService.getAvailableModels(connectionId)
      
      if (models && models.length > 0) {
        // Map existing enabled state to new models
        const existingModelStates = new Map(
          connection.availableModels.map((m: any) => [m.id, m.enabled])
        )
        
        // Create updated models list, preserving enabled state for existing models
        const updatedModels = models.map(modelId => ({
          id: modelId,
          name: modelId,
          enabled: existingModelStates.has(modelId) ? existingModelStates.get(modelId) : true
        }))
        
        // Update connection with refreshed models
        connection.availableModels = updatedModels
        
        // Save updated settings
        await settingsService.updateSettings({
          aiConnections: settings.aiConnections
        }, user._id)
        
        // Return the updated connection
        const safeConnection = {
          ...connection.toObject ? connection.toObject() : connection,
          apiKey: '***HIDDEN***'
        }

        return {
          success: true,
          data: safeConnection,
          message: `Refreshed ${models.length} models for connection "${connection.name}"`
        }
      } else {
        throw new Error('No models found from API')
      }
    } catch (modelError: any) {
      console.error('Failed to fetch models for connection refresh:', modelError)
      throw createError({
        statusCode: 500,
        statusMessage: modelError.message || 'Failed to fetch models from API'
      })
    }

  } catch (error: any) {
    console.error('Failed to refresh connection models:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to refresh connection models'
    })
  }
}) 