import Settings from '../../models/Settings.js'
import { requireAuth, requireAdmin } from '../../utils/auth.ts'

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
        aiConnections: [],
        server: {
          maxFileSize: 10485760,
          allowedFileTypes: ['pdf', 'txt', 'doc', 'docx']
        },
        updatedBy: user._id
      })
      await settings.save()
      await settings.populate('updatedBy', 'name email')
    }

    // Don't send the actual API keys, just indicate if they're set
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
            pass: settings.email.smtp.auth.pass ? '***HIDDEN***' : null
          } : undefined
        } : undefined
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