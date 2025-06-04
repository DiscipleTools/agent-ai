import settingsService from '~/server/services/settingsService'
import aiService from '~/server/services/aiService'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user
    const connectionId = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!connectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Connection ID is required'
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

    // Find connection to update
    const connectionIndex = settings.aiConnections?.findIndex(
      (conn: any) => conn._id.toString() === connectionId
    )

    if (connectionIndex === -1 || connectionIndex === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: 'AI connection not found'
      })
    }

    const existingConnection = settings.aiConnections[connectionIndex]

    // Validate endpoint URL format if provided
    if (body.endpoint) {
      try {
        new URL(body.endpoint)
      } catch {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid endpoint URL format'
        })
      }
    }

    // Update connection fields
    if (body.name !== undefined) existingConnection.name = body.name.trim()
    if (body.apiKey !== undefined) existingConnection.apiKey = body.apiKey
    if (body.endpoint !== undefined) existingConnection.endpoint = body.endpoint
    if (body.provider !== undefined) existingConnection.provider = body.provider
    if (body.availableModels !== undefined) existingConnection.availableModels = body.availableModels
    if (body.isActive !== undefined) existingConnection.isActive = body.isActive

    // Update settings
    const updatedSettings = await settingsService.updateSettings({
      aiConnections: settings.aiConnections
    }, user._id)
    const updatedConnection = updatedSettings.aiConnections[connectionIndex]

    // If connection details changed, try to refresh models
    if (body.apiKey || body.endpoint) {
      try {
        const models = await aiService.getAvailableModels(connectionId)
        
        // Update connection with fetched models, preserving enabled/disabled state
        const existingModelIds = new Set(updatedConnection.availableModels.map((m: any) => m.id))
        const newModels = models.map(modelId => {
          const existing = updatedConnection.availableModels.find((m: any) => m.id === modelId)
          return {
            id: modelId,
            name: modelId,
            enabled: existing ? existing.enabled : !existingModelIds.has(modelId) // Enable new models by default
          }
        })
        
        updatedConnection.availableModels = newModels
        await updatedSettings.save()
      } catch (modelError) {
        console.warn('Could not refresh models for updated connection:', modelError)
      }
    }

    // Don't send API key back
    const safeConnection = {
      ...updatedConnection.toObject(),
      apiKey: '***HIDDEN***'
    }

    return {
      success: true,
      data: safeConnection,
      message: 'AI connection updated successfully'
    }
  } catch (error: any) {
    console.error('Failed to update AI connection:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update AI connection'
    })
  }
}) 