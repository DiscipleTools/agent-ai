import Settings from '~/server/models/Settings'
import { Types } from 'mongoose'

interface PredictionGuardConfig {
  apiKey: string
  endpoint: string
  model: string
}

class SettingsService {
  private cachedSettings: any = null
  private cacheExpiry: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  async getPredictionGuardConfig(): Promise<PredictionGuardConfig> {
    try {
      // Check if we have valid cached settings
      if (this.cachedSettings && Date.now() < this.cacheExpiry) {
        return this.buildPredictionGuardConfig(this.cachedSettings)
      }

      // Fetch settings from database
      const settings = await Settings.findOne()
      
      if (settings) {
        // Cache the settings
        this.cachedSettings = settings
        this.cacheExpiry = Date.now() + this.CACHE_DURATION
        
        return this.buildPredictionGuardConfig(settings)
      }

      // Fallback to environment variables if no database settings
      return this.getEnvironmentConfig()

    } catch (error: any) {
      console.warn('Failed to fetch settings from database, using environment variables:', error.message)
      return this.getEnvironmentConfig()
    }
  }

  private buildPredictionGuardConfig(settings: any): PredictionGuardConfig {
    return {
      apiKey: settings.predictionGuard?.apiKey || process.env.PREDICTION_GUARD_API_KEY || '',
      endpoint: settings.predictionGuard?.endpoint || process.env.PREDICTION_GUARD_ENDPOINT || 'https://api.predictionguard.com',
      model: settings.predictionGuard?.model || process.env.PREDICTION_GUARD_DEFAULT_MODEL || 'Hermes-3-Llama-3.1-8B'
    }
  }

  private getEnvironmentConfig(): PredictionGuardConfig {
    return {
      apiKey: process.env.PREDICTION_GUARD_API_KEY || '',
      endpoint: process.env.PREDICTION_GUARD_ENDPOINT || 'https://api.predictionguard.com',
      model: process.env.PREDICTION_GUARD_DEFAULT_MODEL || 'Hermes-3-Llama-3.1-8B'
    }
  }

  // Clear cache when settings are updated
  clearCache(): void {
    this.cachedSettings = null
    this.cacheExpiry = 0
  }

  // Get all settings (for admin use)
  async getAllSettings(): Promise<any> {
    try {
      const settings = await Settings.findOne().populate('updatedBy', 'name email')
      return settings
    } catch (error) {
      console.error('Failed to fetch all settings:', error)
      return null
    }
  }

  // Update settings and clear cache
  async updateSettings(settingsData: any, userId: string | Types.ObjectId): Promise<any> {
    try {
      let settings = await Settings.findOne()

      if (settings) {
        // Update existing settings
        Object.assign(settings, settingsData)
        settings.updatedBy = new Types.ObjectId(userId)
      } else {
        // Create new settings
        settings = new Settings({
          ...settingsData,
          updatedBy: new Types.ObjectId(userId)
        })
      }

      await settings.save()
      await settings.populate('updatedBy', 'name email')

      // Clear cache after update
      this.clearCache()

      return settings
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }
}

export default new SettingsService() 