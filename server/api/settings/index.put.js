import Settings from '../../models/Settings.js'
import settingsService from '../../services/settingsService.ts'
import { requireAuth, requireAdmin } from '../../utils/auth.ts'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user
    const body = await readBody(event)

    // Validate email configuration if provided
    if (body.email) {
      if (body.email.enabled && !body.email.from?.email) {
        throw createError({
          statusCode: 400,
          statusMessage: 'From email address is required when email is enabled'
        })
      }

      // Validate SMTP settings
      if (body.email.enabled) {
        const existingSettings = await Settings.findOne()
        const hasExistingSmtpPass = existingSettings?.email?.smtp?.auth?.pass
        if (!body.email.smtp?.host || !body.email.smtp?.auth?.user || (!hasExistingSmtpPass && !body.email.smtp?.auth?.pass)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'SMTP host and authentication are required when email is enabled'
          })
        }
      }
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