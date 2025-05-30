import Settings from '../../models/Settings.js'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user
    const body = await readBody(event)

    // Validate required fields - API key is only required if not already set
    const existingSettings = await Settings.findOne()
    const hasExistingApiKey = existingSettings?.predictionGuard?.apiKey
    
    if (!body.predictionGuard?.endpoint) {
      throw createError({
        statusCode: 400,
        statusMessage: 'API endpoint is required'
      })
    }
    
    if (!hasExistingApiKey && !body.predictionGuard?.apiKey) {
      throw createError({
        statusCode: 400,
        statusMessage: 'API key is required for initial setup'
      })
    }

    // Validate endpoint URL format
    try {
      new URL(body.predictionGuard.endpoint)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid endpoint URL format'
      })
    }

    // Use the existing settings we already fetched for validation
    let settings = existingSettings

    if (settings) {
      // Update existing settings
      settings.predictionGuard = {
        apiKey: body.predictionGuard?.apiKey || settings.predictionGuard.apiKey,
        endpoint: body.predictionGuard.endpoint,
        model: body.predictionGuard.model || 'Hermes-3-Llama-3.1-8B'
      }
      
      if (body.server) {
        settings.server = {
          ...settings.server,
          ...body.server
        }
      }
      
      settings.updatedBy = user._id
    } else {
      // Create new settings (API key is required for new settings)
      settings = new Settings({
        predictionGuard: {
          apiKey: body.predictionGuard.apiKey,
          endpoint: body.predictionGuard.endpoint,
          model: body.predictionGuard.model || 'Hermes-3-Llama-3.1-8B'
        },
        server: body.server || {
          maxFileSize: 10485760,
          allowedFileTypes: ['pdf', 'txt', 'doc', 'docx']
        },
        updatedBy: user._id
      })
    }

    await settings.save()
    await settings.populate('updatedBy', 'name email')

    // Don't send the actual API key back
    const response = {
      ...settings.toObject(),
      predictionGuard: {
        ...settings.predictionGuard,
        apiKey: '***HIDDEN***'
      }
    }

    return {
      success: true,
      data: response,
      message: 'Settings updated successfully'
    }
  } catch (error) {
    console.error('Settings update error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update settings'
    })
  }
}) 