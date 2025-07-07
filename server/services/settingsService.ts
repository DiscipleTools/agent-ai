/**
 * Settings Service
 * 
 * Provides methods to retrieve, update, and cache application-wide settings,
 * including AI connections, email configuration, Chatwoot integration, and other
 * system-level options. Handles fetching and updating settings in the database,
 * and exposes utility methods for other services to access configuration data.
 * 
 * Used by: API endpoints and internal services that require access to global settings.
 */

import Settings from '~/server/models/Settings'
import User from '~/server/models/User' // Ensure User model is registered for populate
import { Types } from 'mongoose'
import { sanitizeText, sanitizeEmail, sanitizeUrl, sanitizeAlphaNumeric, sanitizeAndValidateModels, sanitizeObjectId, sanitizeModelId } from '~/utils/sanitize.js'


interface AIConnection {
  _id: string
  name: string
  apiKey: string
  endpoint: string
  provider: 'openai' | 'prediction-guard' | 'custom'
  availableModels: Array<{
    id: string
    name: string
    enabled: boolean
  }>
  isActive: boolean
}

class SettingsService {
  private cachedSettings: any = null
  private cacheExpiry: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  async getDefaultAIConnection(): Promise<{ connection: AIConnection; modelId: string } | null> {
    try {
      const settings = await this.getAllSettings()
      
      if (!settings?.aiConnections?.length) {
        return null
      }

      // Find default connection
      let defaultConnection = null
      let modelId = null

      if (settings.defaultConnection?.connectionId && settings.defaultConnection?.modelId) {
        defaultConnection = settings.aiConnections.find(
          (conn: any) => conn._id.toString() === settings.defaultConnection.connectionId.toString()
        )
        modelId = settings.defaultConnection.modelId
      }

      // If no default or default not found, use first active connection
      if (!defaultConnection) {
        defaultConnection = settings.aiConnections.find((conn: any) => conn.isActive)
        if (defaultConnection && defaultConnection.availableModels?.length) {
          modelId = defaultConnection.availableModels.find((model: any) => model.enabled)?.id || 
                   defaultConnection.availableModels[0]?.id
        }
      }

      if (!defaultConnection) {
        return null
      }

      return {
        connection: defaultConnection,
        modelId: modelId || (defaultConnection.availableModels?.[0]?.id || 'default')
      }

    } catch (error: any) {
      console.error('Failed to get default AI connection:', error)
      return null
    }
  }

  async getAllAIConnections(): Promise<AIConnection[]> {
    try {
      // Force a fresh fetch when specifically asking for AI connections
      this.clearCache()
      const settings = await this.getAllSettings()
      return settings?.aiConnections || []
    } catch (error: any) {
      console.error('Failed to get AI connections:', error)
      return []
    }
  }

  async getChatwootSettings(): Promise<{ url: string; apiToken: string; enabled: boolean } | null> {
    try {
      const settings = await this.getAllSettings()
      
      if (!settings?.chatwoot) {
        return null
      }
      
      return {
        url: settings.chatwoot.url || '',
        apiToken: settings.chatwoot.apiToken || '',
        enabled: settings.chatwoot.enabled || false
      }
    } catch (error: any) {
      console.error('Failed to get Chatwoot settings:', error)
      return null
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
      // Check if we have valid cached settings
      if (this.cachedSettings && Date.now() < this.cacheExpiry) {
        return this.cachedSettings
      }

      const settings = await Settings.findOne().populate('updatedBy', 'name email')
      
      if (settings) {
        // Cache the settings
        this.cachedSettings = settings
        this.cacheExpiry = Date.now() + this.CACHE_DURATION
      }
      
      return settings
    } catch (error) {
      console.error('Failed to fetch all settings:', error)
      return null
    }
  }

  // Update settings and clear cache
  async updateSettings(settingsData: any, userId: string | Types.ObjectId): Promise<any> {
    try {
      // --- Begin: Defense-in-depth sanitization and whitelisting ---
      const sanitized: any = {}
      // AI Connections
      if (Array.isArray(settingsData.aiConnections)) {
        sanitized.aiConnections = settingsData.aiConnections.map((conn: any) => ({
          name: sanitizeText(conn.name),
          apiKey: sanitizeText(conn.apiKey),
          endpoint: sanitizeUrl(conn.endpoint),
          provider: ['openai', 'prediction-guard', 'custom'].includes(conn.provider) ? conn.provider : 'custom',
          availableModels: Array.isArray(conn.availableModels)
            ? conn.availableModels.map((model: any) => ({
                id: sanitizeModelId(model.id),
                name: sanitizeText(model.name),
                enabled: !!model.enabled
              }))
            : [],
          isActive: !!conn.isActive
        }))
      }
      // Default Connection
      if (settingsData.defaultConnection && typeof settingsData.defaultConnection === 'object') {
        sanitized.defaultConnection = {
          connectionId: sanitizeObjectId(settingsData.defaultConnection.connectionId),
          modelId: sanitizeModelId(settingsData.defaultConnection.modelId)
        }
      }
      // Email
      if (settingsData.email && typeof settingsData.email === 'object') {
        sanitized.email = {
          provider: sanitizeText(settingsData.email.provider),
          enabled: !!settingsData.email.enabled,
          from: settingsData.email.from ? {
            name: sanitizeText(settingsData.email.from.name),
            email: sanitizeEmail(settingsData.email.from.email)
          } : undefined,
          smtp: settingsData.email.smtp ? {
            host: sanitizeText(settingsData.email.smtp.host),
            port: Number(settingsData.email.smtp.port),
            secure: !!settingsData.email.smtp.secure,
            auth: settingsData.email.smtp.auth ? {
              user: sanitizeEmail(settingsData.email.smtp.auth.user),
              pass: typeof settingsData.email.smtp.auth.pass === 'string' ? settingsData.email.smtp.auth.pass : undefined
            } : undefined
          } : undefined
        }
      }
      // Server
      if (settingsData.server && typeof settingsData.server === 'object') {
        sanitized.server = {
          maxFileSize: Number(settingsData.server.maxFileSize),
          allowedFileTypes: Array.isArray(settingsData.server.allowedFileTypes)
            ? settingsData.server.allowedFileTypes.map(sanitizeAlphaNumeric)
            : []
        }
      }
      // Chatwoot
      if (settingsData.chatwoot && typeof settingsData.chatwoot === 'object') {
        sanitized.chatwoot = {
          url: sanitizeUrl(settingsData.chatwoot.url),
          apiToken: sanitizeText(settingsData.chatwoot.apiToken),
          enabled: !!settingsData.chatwoot.enabled
        }
      }
      // --- End: Defense-in-depth sanitization and whitelisting ---
      let settings = await Settings.findOne()
      if (settings) {
        // Update existing settings - use findOneAndUpdate to avoid version conflicts
        const updatedSettings = await Settings.findOneAndUpdate(
          { _id: settings._id },
          {
            ...sanitized,
            updatedBy: new Types.ObjectId(userId)
          },
          { 
            new: true,
            runValidators: true
          }
        ).populate('updatedBy', 'name email')
        if (!updatedSettings) {
          throw new Error('Failed to update settings - document not found')
        }
        // Clear cache after update
        this.clearCache()
        return updatedSettings
      } else {
        // Create new settings
        settings = new Settings({
          ...sanitized,
          updatedBy: new Types.ObjectId(userId)
        })
        await settings.save()
        await settings.populate('updatedBy', 'name email')
        // Clear cache after update
        this.clearCache()
        return settings
      }
    } catch (error: any) {
      console.error('SettingsService: Failed to update settings:', error)
      console.error('SettingsService: Error name:', error.name)
      console.error('SettingsService: Error message:', error.message)
      if (error.name === 'ValidationError') {
        console.error('SettingsService: Validation errors:', error.errors)
      }
      if (error.name === 'CastError') {
        console.error('SettingsService: Cast error details:', error)
      }
      throw error
    }
  }
}

export default new SettingsService() 