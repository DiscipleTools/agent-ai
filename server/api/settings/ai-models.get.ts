import aiService from '~/server/services/aiService'
import settingsService from '~/server/services/settingsService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireAuth(event)

    console.log('Fetching available AI models...')

    // Get current configuration
    const config = await settingsService.getPredictionGuardConfig()

    // Get available models from Prediction Guard
    const models = await aiService.getAvailableModels()

    console.log('Available AI models:', models)

    return {
      success: true,
      message: 'Models fetched successfully',
      data: {
        models,
        defaultModel: config.model,
        endpoint: config.endpoint,
        hasApiKey: !!config.apiKey
      }
    }

  } catch (error: any) {
    console.error('Failed to fetch AI models:', error)
    
    // Try to get fallback configuration
    try {
      const config = await settingsService.getPredictionGuardConfig()
      
      return {
        success: false,
        message: error.message || 'Failed to fetch AI models',
        data: {
          models: [config.model],
          defaultModel: config.model,
          endpoint: config.endpoint,
          hasApiKey: !!config.apiKey
        }
      }
    } catch (configError) {
      return {
        success: false,
        message: error.message || 'Failed to fetch AI models',
        data: {
          models: [process.env.PREDICTION_GUARD_DEFAULT_MODEL || 'Hermes-3-Llama-3.1-8B'],
          defaultModel: process.env.PREDICTION_GUARD_DEFAULT_MODEL || 'Hermes-3-Llama-3.1-8B',
          endpoint: process.env.PREDICTION_GUARD_ENDPOINT || 'https://api.predictionguard.com',
          hasApiKey: !!process.env.PREDICTION_GUARD_API_KEY
        }
      }
    }
  }
}) 