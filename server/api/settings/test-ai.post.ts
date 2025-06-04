import aiService from '~/server/services/aiService'
import settingsService from '~/server/services/settingsService'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireAuth(event)

    console.log('Testing AI service connection...')

    // Get current AI connections configuration
    const defaultConnection = await settingsService.getDefaultAIConnection()
    const allConnections = await settingsService.getAllAIConnections()

    // Test the AI service connection
    const result = await aiService.testConnection()

    console.log('AI service test result:', result)

    return {
      success: result.success,
      message: result.message,
      data: {
        model: result.model || defaultConnection?.modelId,
        endpoint: result.endpoint || defaultConnection?.connection.endpoint,
        hasApiKey: !!defaultConnection?.connection.apiKey,
        configSource: {
          apiKey: allConnections.length > 0 ? 'database' : (process.env.PREDICTION_GUARD_API_KEY ? 'environment' : 'none'),
          endpoint: allConnections.length > 0 ? 'database' : 'environment/default',
          model: allConnections.length > 0 ? 'database' : 'environment/default'
        },
        databaseConfigured: allConnections.length > 0,
        connectionsCount: allConnections.length
      }
    }

  } catch (error: any) {
    console.error('AI service test error:', error)
    
    // Still try to get configuration info for debugging
    try {
      const defaultConnection = await settingsService.getDefaultAIConnection()
      const allConnections = await settingsService.getAllAIConnections()
      
      return {
        success: false,
        message: error.message || 'Failed to test AI service',
        data: {
          endpoint: defaultConnection?.connection.endpoint,
          hasApiKey: !!defaultConnection?.connection.apiKey,
          configSource: {
            apiKey: allConnections.length > 0 ? 'database' : (process.env.PREDICTION_GUARD_API_KEY ? 'environment' : 'none'),
            endpoint: allConnections.length > 0 ? 'database' : 'environment/default',
            model: allConnections.length > 0 ? 'database' : 'environment/default'
          },
          databaseConfigured: allConnections.length > 0,
          connectionsCount: allConnections.length
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
          databaseConfigured: false,
          connectionsCount: 0
        }
      }
    }
  }
}) 