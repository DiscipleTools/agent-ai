import Inbox from '~/server/models/Inbox'
import { getUserFromEvent } from '~/server/utils/auth'
import { z } from 'zod'

const testWebhookSchema = z.object({
  inboxId: z.string().length(24), // MongoDB ObjectId length
  testData: z.object({
    event: z.string().default('message_created'),
    data: z.object({
      message: z.string().default('Test message'),
      conversation_id: z.number().default(123),
      account_id: z.number().default(1)
    }).optional()
  }).optional()
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

    const body = await readBody(event)
    const { inboxId, testData = {} } = testWebhookSchema.parse(body)

    // Find inbox
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

    // Prepare test payload
    const testPayload = {
      event: testData.event || 'message_created',
      data: {
        message: testData.data?.message || 'Test webhook message',
        conversation_id: testData.data?.conversation_id || 123,
        account_id: testData.data?.account_id || inbox.accountId,
        inbox_id: inbox.inboxId,
        ...testData.data
      },
      timestamp: new Date().toISOString(),
      test: true
    }

    // Get the full webhook URL (assuming it needs to be a complete URL)
    const baseUrl = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
    const fullWebhookUrl = `${baseUrl}${inbox.webhookUrl}`

    try {
      // Send test webhook to the inbox's webhook URL
      const webhookResponse = await fetch(fullWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': inbox.webhookSecret // Include webhook secret for validation
        },
        body: JSON.stringify(testPayload),
        timeout: 10000 // 10 second timeout
      })

      const responseStatus = webhookResponse.status
      const responseText = await webhookResponse.text()

      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      return {
        success: true,
        message: 'Test webhook sent successfully',
        data: {
          webhook: {
            url: fullWebhookUrl,
            payload: testPayload,
            response: {
              status: responseStatus,
              ok: webhookResponse.ok,
              data: responseData
            }
          },
          inbox: {
            id: inbox._id,
            name: inbox.name,
            webhookUrl: inbox.webhookUrl
          }
        }
      }

    } catch (webhookError: any) {
      console.error('Webhook test failed:', webhookError)
      
      return {
        success: false,
        message: 'Test webhook failed',
        data: {
          webhook: {
            url: fullWebhookUrl,
            payload: testPayload,
            error: webhookError.message
          },
          inbox: {
            id: inbox._id,
            name: inbox.name,
            webhookUrl: inbox.webhookUrl
          }
        }
      }
    }

  } catch (error: any) {
    console.error('Error testing webhook:', error)
    
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

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to test webhook'
    })
  }
})