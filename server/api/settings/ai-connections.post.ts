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

    // Try to fetch models from the new connection
    try {
      const models = await aiService.getAvailableModels(createdConnection._id.toString())
      
      // Update connection with fetched models
      createdConnection.availableModels = models.map(modelId => ({
        id: modelId,
        name: modelId,
        enabled: true
      }))
      
      await updatedSettings.save()
    } catch (modelError) {
      console.warn('Could not fetch models for new connection:', modelError)
      // Connection is still created, just without auto-discovered models
    }

    // Don't send API key back
    const safeConnection = {
      ...createdConnection.toObject(),
      apiKey: '***HIDDEN***'
    }

    return {
      success: true,
      data: safeConnection,
      message: 'AI connection created successfully'
    }
  } catch (error: any) {
    console.error('Failed to create AI connection:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to create AI connection'
    })
  }
}) 