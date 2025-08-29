/**
 * GET /api/settings
 *
 * Retrieves the application settings.
 * Ensures default settings are created if they don't exist.
 * Scrubs sensitive information like API keys and passwords before returning the response.
 */

import Settings from '../../models/Settings.js'
import { chatwootAuthMiddleware } from '../../utils/auth.ts'
import { sanitizeModelId, sanitizeText, sanitizeUrl } from '~/utils/sanitize'


export default chatwootAuthMiddleware.superAdmin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user

    // Get settings (there should only be one document)
    let settings = await Settings.findOne()

    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings({
        aiConnections: [],
        server: {
          maxFileSize: 10485760,
          allowedFileTypes: ['pdf', 'txt', 'doc', 'docx']
        },
        updatedBy: user.id.toString()
      })
      await settings.save()
    }

    const settingsObj = settings.toObject()
    if (settingsObj.predictionGuard) {
      delete settingsObj.predictionGuard
    }

    // Don't send the actual API keys, just indicate if they're set
    const response = {
      ...settingsObj,
      aiConnections: settings.aiConnections?.map(conn => {
        const connObj = conn.toObject()
        return {
          ...connObj,
          apiKey: '***HIDDEN***',
          availableModels: (connObj.availableModels || []).map((model) => ({
            ...model,
            id: sanitizeModelId(model.id),
            name: sanitizeText(model.name)
          }))
        }
      }) || [],
      email: settings.email ? {
        ...settings.email,
        fromAddress: sanitizeText(settings.email.fromAddress),
        fromName: sanitizeText(settings.email.fromName),
        smtp: settings.email.smtp ? {
          ...settings.email.smtp,
          auth: settings.email.smtp.auth ? {
            user: sanitizeText(settings.email.smtp.auth.user),
            pass: settings.email.smtp.auth.pass ? '***HIDDEN***' : null
          } : undefined
        } : undefined
      } : undefined,
      chatwoot: settings.chatwoot ? {
        ...settings.chatwoot,
        accountId: sanitizeText(settings.chatwoot.accountId),
        apiToken: settings.chatwoot.apiToken ? '***HIDDEN***' : null
      } : undefined
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