import aiService from '~/server/services/aiService'
import settingsService from '~/server/services/settingsService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireAuth(event)

    console.log('Fetching available AI models...')

    // Get current AI connections configuration
    const defaultConnection = await settingsService.getDefaultAIConnection()

    // Get available models using the AI service
    const models = await aiService.getAvailableModels()

    console.log('Available AI models:', models)

    return {
      success: true,
      message: 'Models fetched successfully',
      data: {
        models,
        defaultModel: defaultConnection?.modelId,
        endpoint: defaultConnection?.connection.endpoint,
        hasApiKey: !!defaultConnection?.connection.apiKey
      }
    }

  } catch (error: any) {
    console.error('Failed to fetch AI models:', error)
    
    // Try to get fallback configuration
    try {
      const defaultConnection = await settingsService.getDefaultAIConnection()
      
      return {
        success: false,
        message: error.message || 'Failed to fetch AI models',
        data: {
          models: defaultConnection?.modelId ? [defaultConnection.modelId] : [],
          defaultModel: defaultConnection?.modelId,
          endpoint: defaultConnection?.connection.endpoint,
          hasApiKey: !!defaultConnection?.connection.apiKey
        }
      }
    } catch (configError) {
      return {
        success: false,
        message: error.message || 'Failed to fetch AI models',
        data: {
          models: [],
          defaultModel: null,
          endpoint: null,
          hasApiKey: false
        }
      }
    }
  }
}) 