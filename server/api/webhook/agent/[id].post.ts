import { connectDB } from '~/server/utils/db'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Get webhook ID from params
    const webhookId = getRouterParam(event, 'id')
    
    if (!webhookId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Webhook ID is required'
      })
    }

    // Find agent by webhook URL
    const webhookUrl = `/api/webhook/agent/${webhookId}`
    const agent = await Agent.findOne({ webhookUrl, isActive: true })

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found or inactive'
      })
    }

    // Get webhook payload
    const payload = await readBody(event)

    // Validate Chatwoot webhook payload
    if (!payload.message || !payload.conversation) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid webhook payload'
      })
    }

    // Skip if message is outgoing (from agent)
    if (payload.message.message_type === 'outgoing') {
      return {
        success: true,
        message: 'Skipped outgoing message'
      }
    }

    // Skip if no message content
    if (!payload.message.content || !payload.message.content.trim()) {
      return {
        success: true,
        message: 'Skipped empty message'
      }
    }

    console.log('Webhook received for agent:', agent.name)
    console.log('Message:', payload.message.content)
    console.log('Conversation ID:', payload.conversation.id)

    // Generate placeholder response: reverse each word
    const originalMessage = payload.message.content.trim()
    const reversedMessage = originalMessage
      .split(' ')
      .map((word: string) => word.split('').reverse().join(''))
      .join(' ')

    // This is what actually gets sent to Chatwoot
    const responseMessage = reversedMessage

    // Add configured delay if any
    const agentSettings = agent.settings as any
    if (agentSettings?.responseDelay && agentSettings.responseDelay > 0) {
      console.log(`Waiting ${agentSettings.responseDelay} seconds before responding...`)
      await new Promise(resolve => setTimeout(resolve, agentSettings.responseDelay * 1000))
    }

    // Send response back to Chatwoot
    try {
      await chatwootService.sendMessage(
        payload.conversation.account_id,
        payload.conversation.id,
        responseMessage
      )

      console.log('Response sent successfully to Chatwoot')

      return {
        success: true,
        message: 'Webhook processed and response sent',
        data: {
          agentId: agent._id,
          agentName: agent.name,
          originalMessage,
          responseMessage,
          conversationId: payload.conversation.id,
          accountId: payload.conversation.account_id
        }
      }

    } catch (chatwootError: any) {
      console.error('Failed to send response to Chatwoot:', chatwootError)
      
      // Still return success to prevent webhook retries
      return {
        success: true,
        message: 'Webhook processed but failed to send response to Chatwoot',
        error: chatwootError.message,
        data: {
          agentId: agent._id,
          agentName: agent.name,
          originalMessage,
          responseMessage
        }
      }
    }

  } catch (error: any) {
    console.error('Webhook processing error:', error)
    
    // Return 200 to prevent Chatwoot from retrying
    // (webhook failures shouldn't cause Chatwoot to retry indefinitely)
    return {
      success: false,
      error: error.message || 'Webhook processing failed'
    }
  }
}) 