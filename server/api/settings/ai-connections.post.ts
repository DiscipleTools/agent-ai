import settingsService from '~/server/services/settingsService'
import aiService from '~/server/services/aiService'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user
    const body = await readBody(event)

    // Validate required fields
    if (!body.name || !body.apiKey || !body.endpoint) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name, API key, and endpoint are required'
      })
    }

    // Validate endpoint URL format
    try {
      new URL(body.endpoint)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid endpoint URL format'
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

    // Create new connection
    const newConnection = {
      name: body.name.trim(),
      apiKey: body.apiKey,
      endpoint: body.endpoint,
      provider: body.provider || 'custom',
      availableModels: body.availableModels || [],
      isActive: body.isActive !== false
    }

    // Add connection to settings
    const aiConnections = settings.aiConnections || []
    aiConnections.push(newConnection)

    // Update settings
    const updatedSettings = await settingsService.updateSettings({
      aiConnections
    }, user._id)

    // Get the newly created connection (with _id)
    const createdConnection = updatedSettings.aiConnections[updatedSettings.aiConnections.length - 1]
    
    if (!createdConnection) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create AI connection - connection not found after creation'
      })
    }

    // Try to fetch models from the new connection
    try {
      const models = await aiService.getAvailableModels(createdConnection._id.toString())
      
      // Only update if we have valid models
      if (models && models.length > 0) {
        // Update connection with fetched models, ensuring each model has proper id and name
        const validModels = models
          .filter(modelId => modelId && typeof modelId === 'string' && modelId.trim())
          .map(modelId => ({
            id: modelId.trim(),
            name: modelId.trim(),
            enabled: true
          }))
        
        if (validModels.length > 0) {
          createdConnection.availableModels = validModels
          await updatedSettings.save()
        }
      }
    } catch (modelError) {
      console.warn('Could not fetch models for new connection:', modelError)
      // Connection is still created, just without auto-discovered models
    }

    // Safely create response object without toObject() call
    const safeConnection = {
      _id: createdConnection._id,
      name: createdConnection.name,
      provider: createdConnection.provider,
      endpoint: createdConnection.endpoint,
      availableModels: createdConnection.availableModels || [],
      isActive: createdConnection.isActive,
      apiKey: '***HIDDEN***'
    }

    return {
      success: true,
      data: safeConnection,
      message: 'AI connection created successfully'
    }
  } catch (error: any) {
    console.error('Failed to create AI connection:', error)
    
    // Log more detailed error information
    if (error.name === 'ValidationError') {
      console.error('Mongoose validation error details:', error.errors)
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to create AI connection'
    })
  }
}) 