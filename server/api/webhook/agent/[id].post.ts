import { connectDB } from '~/server/utils/db'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'
import aiService from '~/server/services/aiService'

interface AgentSettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
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

    // Generate AI response using the agent's prompt and context
    let responseMessage: string
    
    try {
      responseMessage = await aiService.generateResponse(
        agent._id,
        agent.prompt,
        agent.contextDocuments || [],
        payload.message.content.trim(),
        {
          temperature: agent.settings?.temperature,
          maxTokens: agent.settings?.maxTokens,
          responseDelay: agent.settings?.responseDelay
        }
      )
      
      console.log('AI response generated:', {
        agentName: agent.name,
        responseLength: responseMessage.length,
        originalMessage: payload.message.content.substring(0, 100) + (payload.message.content.length > 100 ? '...' : '')
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
        userMessage: payload.message.content
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
        payload.conversation.account_id,
        payload.conversation.id,
        responseMessage
      )

      console.log('Response sent successfully to Chatwoot')

      return {
        success: true,
        message: 'Webhook processed and AI response sent',
        data: {
          agentId: agent._id,
          agentName: agent.name,
          originalMessage: payload.message.content,
          responseMessage,
          conversationId: payload.conversation.id,
          accountId: payload.conversation.account_id,
          responseLength: responseMessage.length,
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
          originalMessage: payload.message.content,
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