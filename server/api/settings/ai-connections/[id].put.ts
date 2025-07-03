/**
 * @description Updates an existing AI connection configuration.
 * @endpoint PUT /api/settings/ai-connections/[id]
 */
import { sanitizeText, sanitizeUrl } from '~/utils/sanitize'
import settingsService from '~/server/services/settingsService'
import aiService from '~/server/services/aiService'
import { authMiddleware } from '~/server/utils/auth'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
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

    // Validate and sanitize endpoint URL if provided to prevent SSRF
    if (body.endpoint) {
      const sanitizedUrl = sanitizeUrl(body.endpoint)
      if (!sanitizedUrl) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid or insecure endpoint URL provided'
        })
      }
      body.endpoint = sanitizedUrl
    }

    // Update connection fields with sanitized data
    if (body.name !== undefined) existingConnection.name = sanitizeText(body.name)
    if (body.apiKey !== undefined) existingConnection.apiKey = body.apiKey
    if (body.endpoint !== undefined) existingConnection.endpoint = body.endpoint
    if (body.provider !== undefined) existingConnection.provider = sanitizeText(body.provider)

    if (body.availableModels !== undefined) {
      if (Array.isArray(body.availableModels)) {
        existingConnection.availableModels = body.availableModels.map((model: any) => {
          if (model && typeof model === 'object' && model.id && model.name) {
            return {
              id: sanitizeText(String(model.id)),
              name: sanitizeText(String(model.name)),
              enabled: !!model.enabled,
            }
          }
          return null
        }).filter(Boolean) // filter out nulls
      } else {
        existingConnection.availableModels = [] // Overwrite if malformed
      }
    }
    
    if (body.isActive !== undefined) existingConnection.isActive = !!body.isActive

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