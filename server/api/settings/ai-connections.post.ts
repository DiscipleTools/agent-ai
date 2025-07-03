import settingsService from '~/server/services/settingsService'
import aiService from '~/server/services/aiService'
import { authMiddleware } from '~/server/utils/auth'
import { sanitizeText, sanitizeUrl, validators } from '~/utils/sanitize.js'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
    const body = await readBody(event)

    // Enhanced validation and sanitization
    const validationErrors = []

    // Validate and sanitize required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      validationErrors.push('Connection name is required')
    } else {
      const sanitizedName = sanitizeText(body.name)
      if (!validators.textLength(sanitizedName, 2, 100)) {
        validationErrors.push('Connection name must be between 2 and 100 characters')
      }
      body.name = sanitizedName
    }

    if (!body.apiKey || typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
      validationErrors.push('API key is required')
    } else if (body.apiKey.length > 512) {
      validationErrors.push('API key is too long (maximum 512 characters)')
    }

    if (!body.endpoint || typeof body.endpoint !== 'string' || body.endpoint.trim().length === 0) {
      validationErrors.push('Endpoint URL is required')
    } else {
      const sanitizedEndpoint = sanitizeUrl(body.endpoint)
      if (!validators.validUrl(sanitizedEndpoint)) {
        validationErrors.push('Please enter a valid endpoint URL')
      }
      body.endpoint = sanitizedEndpoint
    }

    // Validate optional fields
    if (body.provider) {
      const sanitizedProvider = sanitizeText(body.provider)
      if (!['openai', 'prediction-guard', 'custom'].includes(sanitizedProvider)) {
        validationErrors.push('Provider must be openai, prediction-guard, or custom')
      }
      body.provider = sanitizedProvider
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: validationErrors.join(', ')
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

    // Create new connection (data is already sanitized)
    const newConnection = {
      name: body.name,
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