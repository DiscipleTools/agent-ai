/**
 * @fileoverview Handles updating application settings.
 *
 * @endpoint PUT /api/settings
 * @security Admin-only endpoint.
 */
import Settings from '../../models/Settings.js'
import settingsService from '../../services/settingsService.ts'
import { authMiddleware } from '../../utils/auth.ts'
import { sanitizeText, sanitizeEmail, sanitizeUrl, sanitizeAlphaNumeric, validators } from '~/utils/sanitize.js'

export default authMiddleware.admin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
    const body = await readBody(event)

    // Enhanced validation and sanitization
    const validationErrors = []

    // Validate and sanitize email configuration if provided
    if (body.email) {
      if (body.email.enabled && !body.email.from?.email) {
        validationErrors.push('From email address is required when email is enabled')
      }

      if (body.email.from?.email) {
        const sanitizedEmail = sanitizeEmail(body.email.from.email)
        if (!validators.validEmail(sanitizedEmail)) {
          validationErrors.push('Please enter a valid from email address')
        }
        body.email.from.email = sanitizedEmail
      }

      if (body.email.from?.name) {
        const sanitizedName = sanitizeText(body.email.from.name)
        if (!validators.textLength(sanitizedName, 1, 100)) {
          validationErrors.push('From name must be between 1 and 100 characters')
        }
        body.email.from.name = sanitizedName
      }

      // Validate SMTP settings
      if (body.email.enabled) {
        const existingSettings = await Settings.findOne()
        const hasExistingSmtpPass = existingSettings?.email?.smtp?.auth?.pass

        if (body.email.smtp?.host) {
          const sanitizedHost = sanitizeText(body.email.smtp.host)
          if (!validators.textLength(sanitizedHost, 1, 255)) {
            validationErrors.push('SMTP host must be between 1 and 255 characters')
          }
          body.email.smtp.host = sanitizedHost
        } else if (body.email.enabled) {
          validationErrors.push('SMTP host is required when email is enabled')
        }

        if (body.email.smtp?.port) {
          if (!validators.numberRange(body.email.smtp.port, 1, 65535)) {
            validationErrors.push('SMTP port must be between 1 and 65535')
          }
        }

        if (body.email.smtp?.auth?.user) {
          const sanitizedUser = sanitizeEmail(body.email.smtp.auth.user)
          if (!validators.validEmail(sanitizedUser)) {
            validationErrors.push('SMTP username must be a valid email address')
          }
          body.email.smtp.auth.user = sanitizedUser
        } else if (body.email.enabled) {
          validationErrors.push('SMTP username is required when email is enabled')
        }

        if (!hasExistingSmtpPass && (!body.email.smtp?.auth?.pass || body.email.smtp.auth.pass.trim().length === 0)) {
          validationErrors.push('SMTP password is required when email is enabled')
        }

        // Add password length validation
        if (body.email.smtp?.auth?.pass && body.email.smtp.auth.pass.length > 512) {
          validationErrors.push('SMTP password cannot be more than 512 characters')
        }
      }
    }

    // Validate and sanitize server settings if provided
    if (body.server) {
      if (body.server.maxFileSize) {
        if (!validators.numberRange(body.server.maxFileSize, 1, 100 * 1024 * 1024)) { // 100MB
          validationErrors.push('Max file size must be between 1 and 104857600 bytes')
        }
      }

      if (body.server.allowedFileTypes) {
        if (!Array.isArray(body.server.allowedFileTypes)) {
          validationErrors.push('Allowed file types must be an array')
        } else {
          body.server.allowedFileTypes.forEach((type, index) => {
            const sanitizedType = sanitizeAlphaNumeric(type)
            if (!validators.textLength(sanitizedType, 1, 10)) {
              validationErrors.push(`Allowed file type at index ${index} is invalid`)
            }
            body.server.allowedFileTypes[index] = sanitizedType
          })
        }
      }
    }

    // Validate and sanitize Chatwoot configuration if provided
    if (body.chatwoot) {
      if (body.chatwoot.url) {
        const sanitizedUrl = sanitizeUrl(body.chatwoot.url)
        if (!validators.validUrl(sanitizedUrl)) {
          validationErrors.push('Please enter a valid Chatwoot URL')
        }
        body.chatwoot.url = sanitizedUrl
      } else if (body.chatwoot.enabled) {
        validationErrors.push('Chatwoot URL is required when Chatwoot is enabled')
      }

      // API token validation (don't sanitize, but validate length)
      if (body.chatwoot.apiToken && body.chatwoot.apiToken.length > 512) {
        validationErrors.push('Chatwoot API token is too long')
      }
    }

    // Validate AI connections if provided
    if (body.aiConnections && Array.isArray(body.aiConnections)) {
      body.aiConnections.forEach((connection, index) => {
        if (connection.name) {
          const sanitizedName = sanitizeText(connection.name)
          if (!validators.textLength(sanitizedName, 2, 100)) {
            validationErrors.push(`AI connection ${index + 1} name must be between 2 and 100 characters`)
          }
          connection.name = sanitizedName
        }

        if (connection.endpoint) {
          const sanitizedEndpoint = sanitizeUrl(connection.endpoint)
          if (!validators.validUrl(sanitizedEndpoint)) {
            validationErrors.push(`AI connection ${index + 1} endpoint must be a valid URL`)
          }
          connection.endpoint = sanitizedEndpoint
        }

        if (connection.provider) {
          const sanitizedProvider = sanitizeText(connection.provider)
          if (!['openai', 'prediction-guard', 'custom'].includes(sanitizedProvider)) {
            validationErrors.push(`AI connection ${index + 1} provider must be openai, prediction-guard, or custom`)
          }
          connection.provider = sanitizedProvider
        }

        // API key validation (don't sanitize, but validate length)
        if (connection.apiKey && connection.apiKey.length > 512) {
          validationErrors.push(`AI connection ${index + 1} API key is too long`)
        }
      })
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: validationErrors.join(', ')
      })
    }

    // Use the existing settings we already fetched for validation
    let settings = await Settings.findOne()

    if (settings) {
      // Update email settings if provided
      if (body.email) {
        // Update email settings in place to avoid Mongoose validation issues
        
        // Update basic email settings
        if (body.email.enabled !== undefined) {
          settings.email.enabled = body.email.enabled
        }
        if (body.email.provider) {
          settings.email.provider = body.email.provider
        }
        if (body.email.from) {
          if (!settings.email.from) {
            settings.email.from = {}
          }
          if (body.email.from.email) {
            settings.email.from.email = body.email.from.email
          }
          if (body.email.from.name) {
            settings.email.from.name = body.email.from.name
          }
        }
        
        // Update provider-specific configurations
        if (body.email.smtp) {
          if (!settings.email.smtp) {
            settings.email.smtp = {}
          }
          
          // Preserve existing values and update with new ones
          if (body.email.smtp.host !== undefined) settings.email.smtp.host = body.email.smtp.host
          if (body.email.smtp.port !== undefined) settings.email.smtp.port = body.email.smtp.port  
          if (body.email.smtp.secure !== undefined) settings.email.smtp.secure = body.email.smtp.secure
          
          if (body.email.smtp.auth) {
            if (!settings.email.smtp.auth) {
              settings.email.smtp.auth = {}
            }
            
            // Update auth fields individually to preserve existing password
            if (body.email.smtp.auth.user !== undefined) {
              settings.email.smtp.auth.user = body.email.smtp.auth.user
            }
            // Only update password if one is provided
            if (body.email.smtp.auth.pass !== undefined) {
              settings.email.smtp.auth.pass = body.email.smtp.auth.pass
            }
          }
        }
      }
      
      // Update AI connections if provided
      if (body.aiConnections) {
        settings.aiConnections = body.aiConnections
      }
      
      // Update default connection if provided
      if (body.defaultConnection) {
        settings.defaultConnection = body.defaultConnection
      }
      
      if (body.server) {
        settings.server = {
          ...settings.server,
          ...body.server
        }
      }
      
      if (body.chatwoot) {
        settings.chatwoot = {
          ...settings.chatwoot,
          ...body.chatwoot
        }
      }
      
      settings.updatedBy = user._id
    } else {
      // Create new settings
      settings = new Settings({
        aiConnections: body.aiConnections || [],
        defaultConnection: body.defaultConnection || null,
        email: body.email || {
          provider: 'smtp',
          enabled: false,
          from: {
            name: 'Agent AI Server'
          }
        },
        server: body.server || {
          maxFileSize: 10485760,
          allowedFileTypes: ['pdf', 'txt', 'doc', 'docx']
        },
        chatwoot: body.chatwoot || {
          enabled: false
        },
        updatedBy: user._id
      })
    }

    await settings.save()
    await settings.populate('updatedBy', 'name email')

    // Clear the settings cache so AI service picks up new configuration
    settingsService.clearCache()

    // Don't send sensitive data back
    const response = {
      ...settings.toObject(),
      aiConnections: settings.aiConnections?.map(conn => ({
        ...conn.toObject(),
        apiKey: '***HIDDEN***'
      })) || [],
      email: settings.email ? {
        ...settings.email,
        smtp: settings.email.smtp ? {
          ...settings.email.smtp,
          auth: settings.email.smtp.auth ? {
            user: settings.email.smtp.auth.user,
            pass: '***HIDDEN***'
          } : undefined
        } : undefined
      } : undefined,
      chatwoot: settings.chatwoot ? {
        ...settings.chatwoot,
        apiToken: settings.chatwoot.apiToken ? '***HIDDEN***' : null
      } : undefined
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