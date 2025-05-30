import Settings from '../../models/Settings.js'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user

    // Get settings (there should only be one document)
    let settings = await Settings.findOne().populate('updatedBy', 'name email')

    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings({
        predictionGuard: {
          endpoint: 'https://api.predictionguard.com',
          model: 'Hermes-3-Llama-3.1-8B'
        },
        server: {
          maxFileSize: 10485760,
          allowedFileTypes: ['pdf', 'txt', 'doc', 'docx']
        },
        updatedBy: user._id
      })
      await settings.save()
      await settings.populate('updatedBy', 'name email')
    }

    // Don't send the actual API key, just indicate if it's set
    const response = {
      ...settings.toObject(),
      predictionGuard: {
        ...settings.predictionGuard,
        apiKey: settings.predictionGuard.apiKey ? '***HIDDEN***' : null
      }
    }

    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error('Settings fetch error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch settings'
    })
  }
}) 