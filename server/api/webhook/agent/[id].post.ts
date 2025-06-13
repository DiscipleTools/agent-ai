import { connectDB } from '~/server/utils/db'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'
import aiService from '~/server/services/aiService'

interface AgentSettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
  connectionId?: string
  modelId?: string
}

interface AgentDocument {
  _id: string
  name: string
  prompt: string
  webhookUrl: string
  contextDocuments?: Array<{
    type: 'file' | 'url'
    content: string
    filename?: string
    url?: string
  }>
  settings?: AgentSettings
  isActive: boolean
}

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
    const agent = await Agent.findOne({ webhookUrl, isActive: true }) as AgentDocument | null

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found or inactive'
      })
    }

    // Get webhook payload
    const payload = await readBody(event)

    // Validate ChatWoot webhook payload
    if (!payload || typeof payload !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid webhook payload: not an object'
      })
    }

    // Skip if this is not a message_created event
    if (payload.event !== 'message_created') {
      console.log('Received non-message event:', payload.event || 'unknown')
      return {
        success: true,
        message: `Skipped ${payload.event || 'unknown'} event`
      }
    }

    // ChatWoot sends the message data directly in the payload for message_created events
    if (!payload.conversation) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid webhook payload: missing conversation data'
      })
    }

    // Extract message and conversation data from ChatWoot payload
    // In ChatWoot, the message data is at the top level, conversation is nested
    const messageContent = payload.content || ''
    const conversationObj = payload.conversation
    const accountId = payload.account?.id || conversationObj?.account_id || 1

    // Skip if message is outgoing or template (from agent/bot/system)
    if (payload.message_type === 'outgoing' || payload.message_type === 'template') {
      return {
        success: true,
        message: `Skipped ${payload.message_type} message`
      }
    }

    // Skip if no message content
    if (!messageContent || !messageContent.trim()) {
      return {
        success: true,
        message: 'Skipped empty message'
      }
    }

    console.log('Webhook received for agent:', agent.name)
    console.log('Message length:', messageContent.length, 'characters')
    console.log('Conversation ID:', conversationObj?.id || 'unknown')
    console.log('Account ID:', accountId)

    // Generate AI response using the agent's prompt and context
    let responseMessage: string
    
    try {
      responseMessage = await aiService.generateResponse(
        agent._id,
        agent.prompt,
        agent.contextDocuments || [],
        messageContent.trim(),
        {
          temperature: agent.settings?.temperature,
          maxTokens: agent.settings?.maxTokens,
          responseDelay: agent.settings?.responseDelay,
          connectionId: agent.settings?.connectionId,
          modelId: agent.settings?.modelId
        }
      )
      
      console.log('AI response generated:', {
        agentName: agent.name,
        responseLength: responseMessage.length,
        originalMessageLength: messageContent.length
      })
      
    } catch (aiError: any) {
      console.error('AI generation failed:', aiError)
      
      // Fallback response when AI fails
      responseMessage = "I apologize, but I'm experiencing technical difficulties right now. Please try again later or contact support if the issue persists."
      
      // Log the error for monitoring
      console.error('AI Service Error Details:', {
        agentId: agent._id,
        agentName: agent.name,
        error: aiError.message,
        userMessageLength: messageContent.length
      })
    }

    // Add configured delay if any
    if (agent.settings?.responseDelay && agent.settings.responseDelay > 0) {
      console.log(`Waiting ${agent.settings.responseDelay} seconds before responding...`)
      await aiService.delay(agent.settings.responseDelay * 1000)
    }

    // Send response back to Chatwoot
    try {
      await chatwootService.sendMessage(
        accountId,
        conversationObj?.id || 0,
        responseMessage
      )

      console.log('Response sent successfully to Chatwoot')

      return {
        success: true,
        message: 'Webhook processed and AI response sent',
        data: {
          agentId: agent._id,
          agentName: agent.name,
          originalMessageLength: messageContent.length,
          responseLength: responseMessage.length,
          conversationId: conversationObj?.id || 0,
          accountId: accountId,
          hasContextDocuments: (agent.contextDocuments || []).length > 0
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
          originalMessageLength: messageContent.length,
          responseLength: responseMessage.length
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