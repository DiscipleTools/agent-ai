import Inbox from '~/server/models/Inbox'
import { getUserFromEvent } from '~/server/utils/auth'
import { z } from 'zod'

const updateInboxSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  channelType: z.enum(['email', 'web_widget', 'api', 'whatsapp', 'facebook', 'twitter', 'telegram', 'line', 'sms', 'website']).optional(),
  chatwoot: z.object({
    apiKey: z.string().optional(),
    botId: z.number().int().positive().optional(),
    botName: z.string().optional(),
    isConfigured: z.boolean().optional()
  }).optional(),
  settings: z.object({
    processDelay: z.number().min(0).max(60).optional(),
    enableLogging: z.boolean().optional(),
    enableAnalytics: z.boolean().optional()
  }).optional(),
  isActive: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const inboxId = getRouterParam(event, 'id')
    if (!inboxId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Inbox ID is required'
      })
    }

    const body = await readBody(event)
    
    // Validate input
    const validatedData = updateInboxSchema.parse(body)

    // Find and update inbox
    const inbox = await Inbox.findOne({
      _id: inboxId,
      createdBy: user.id || user._id
    })

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Update fields
    Object.entries(validatedData).forEach(([key, value]) => {
      if (key === 'chatwoot' && typeof value === 'object') {
        inbox.chatwoot = { ...inbox.chatwoot, ...value }
      } else if (key === 'settings' && typeof value === 'object') {
        inbox.settings = { ...inbox.settings, ...value }
      } else {
        (inbox as any)[key] = value
      }
    })

    await inbox.save()

    // Populate agent references before returning
    await inbox.populate([
      { path: 'responseAgent.agentId', select: 'name agentType' },
      { path: 'agents.agentId', select: 'name agentType' }
    ])

    return {
      success: true,
      message: 'Inbox updated successfully',
      data: { inbox }
    }

  } catch (error: any) {
    console.error('Error updating inbox:', error)
    
    if (error.statusCode) {
      throw error
    }

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid input data',
        data: { errors: error.errors }
      })
    }

    if (error.name === 'ValidationError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        data: { errors: error.errors }
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update inbox'
    })
  }
})