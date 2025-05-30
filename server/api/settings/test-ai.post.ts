import aiService from '~/server/services/aiService'
import settingsService from '~/server/services/settingsService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireAuth(event)

    console.log('Testing AI service connection...')

    // Get current configuration
    const config = await settingsService.getPredictionGuardConfig()
    const dbSettings = await settingsService.getAllSettings()

    // Test the AI service connection
    const result = await aiService.testConnection()

    console.log('AI service test result:', result)

    return {
      success: result.success,
      message: result.message,
      data: {
        model: result.model || config.model,
        endpoint: result.endpoint || config.endpoint,
        hasApiKey: !!config.apiKey,
        configSource: {
          apiKey: dbSettings?.predictionGuard?.apiKey ? 'database' : (process.env.PREDICTION_GUARD_API_KEY ? 'environment' : 'none'),
          endpoint: dbSettings?.predictionGuard?.endpoint ? 'database' : 'environment/default',
          model: dbSettings?.predictionGuard?.model ? 'database' : 'environment/default'
        },
        databaseConfigured: !!dbSettings?.predictionGuard?.apiKey
      }
    }

  } catch (error: any) {
    console.error('AI service test error:', error)
    
    // Still try to get configuration info for debugging
    try {
      const config = await settingsService.getPredictionGuardConfig()
      const dbSettings = await settingsService.getAllSettings()
      
      return {
        success: false,
        message: error.message || 'Failed to test AI service',
        data: {
          endpoint: config.endpoint,
          hasApiKey: !!config.apiKey,
          configSource: {
            apiKey: dbSettings?.predictionGuard?.apiKey ? 'database' : (process.env.PREDICTION_GUARD_API_KEY ? 'environment' : 'none'),
            endpoint: dbSettings?.predictionGuard?.endpoint ? 'database' : 'environment/default',
            model: dbSettings?.predictionGuard?.model ? 'database' : 'environment/default'
          },
          databaseConfigured: !!dbSettings?.predictionGuard?.apiKey
        }
      }
    } catch (configError) {
      return {
        success: false,
        message: error.message || 'Failed to test AI service',
        data: {
          endpoint: process.env.PREDICTION_GUARD_ENDPOINT || 'https://api.predictionguard.com',
          hasApiKey: !!process.env.PREDICTION_GUARD_API_KEY,
          configSource: {
            apiKey: process.env.PREDICTION_GUARD_API_KEY ? 'environment' : 'none',
            endpoint: 'environment/default',
            model: 'environment/default'
          },
          databaseConfigured: false
        }
      }
    }
  }
}) 