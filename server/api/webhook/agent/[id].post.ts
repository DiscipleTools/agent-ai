/**
 * @description Handles incoming ChatWoot webhooks for a specific agent.
 *              It processes new messages, generates an AI response, and sends it back to the ChatWoot conversation.
 * @endpoint POST /api/webhook/agent/[id]
 */
import { connectDB } from '~/server/utils/db'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'
import aiService from '~/server/services/aiService'
import { sanitizeContent, sanitizeNumber } from '~/utils/sanitize.js'

interface AgentSettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
  connectionId?: string
  modelId?: string
  chatwootApiKey?: string
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
    const conversationId = conversationObj?.id || 0

    // Sanitize critical inputs from the webhook payload
    const sanitizedMessage = sanitizeContent(messageContent)
    const sanitizedAccountId = sanitizeNumber(accountId)
    const sanitizedConversationId = sanitizeNumber(conversationId)

    // Skip if message is outgoing or template (from agent/bot/system)
    if (payload.message_type === 'outgoing' || payload.message_type === 'template') {
      return {
        success: true,
        message: `Skipped ${payload.message_type} message`
      }
    }

    // Skip if no message content
    if (!sanitizedMessage || !sanitizedMessage.trim()) {
      return {
        success: true,
        message: 'Skipped empty message'
      }
    }

    console.log('Webhook received for agent:', agent.name)
    console.log('Message length:', sanitizedMessage.length, 'characters')
    console.log('Conversation ID:', sanitizedConversationId || 'unknown')
    console.log('Account ID:', sanitizedAccountId)
    console.log('Conversation status:', conversationObj?.status || 'unknown')

    // Check if conversation status is "pending" and update it to "open" (async, non-blocking)
    if (conversationObj?.status === 'pending') {
      console.log('Conversation is pending, updating status to "open" asynchronously...')
      // Run status update in background without waiting
      chatwootService.updateConversationStatus(
        sanitizedAccountId,
        sanitizedConversationId,
        'open',
        agent.settings?.chatwootApiKey
      ).then(() => {
        console.log('Successfully updated conversation status from "pending" to "open"')
      }).catch((statusError: any) => {
        console.warn('Failed to update conversation status:', statusError.message)
      })
    }

    // Fetch conversation history via Chatwoot API to get full context
    let conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
    
    try {
      // Try to fetch conversation messages via API
      const messages = await chatwootService.getConversationMessages(
        sanitizedAccountId,
        sanitizedConversationId,
        agent.settings?.chatwootApiKey
      )
      
      if (messages && Array.isArray(messages)) {
        // Transform Chatwoot messages to OpenAI format
        // Filter out the current message and only include recent messages (last 10)
        conversationHistory = messages
          .filter(msg => 
            msg.content && 
            msg.content.trim() && 
            msg.content !== sanitizedMessage.trim() && // Exclude current message
            msg.id !== payload.id // Exclude current message by ID too
          )
          .slice(-10) // Get last 10 messages for context
          .map((msg): { role: 'user' | 'assistant', content: string } => {
            // In Chatwoot: message_type 0 = incoming (user), 1 = outgoing (agent)  
            // Also handle string values: 'incoming' vs 'outgoing'
            const isIncoming = msg.message_type === 0 || 
                              msg.message_type === 'incoming' || 
                              msg.sender_type === 'Contact'
            const role: 'user' | 'assistant' = isIncoming ? 'user' : 'assistant'
            return {
              role,
              content: sanitizeContent(msg.content.trim())
            }
          })
          .filter(msg => msg.content.length > 0) // Remove empty messages
          
        console.log(`Retrieved ${conversationHistory.length} previous messages via API for context`)
        
        // Log conversation history for debugging
        if (conversationHistory.length > 0) {
          console.log('Conversation history:')
          conversationHistory.forEach((msg, index) => {
            console.log(`  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`)
          })
        }
      } else {
        console.log('No previous messages found in conversation')
      }
    } catch (historyError: any) {
      console.warn('Could not retrieve conversation history:', historyError.message)
      console.log('Continuing without conversation context...')
      conversationHistory = []
    }

    // Generate AI response using the agent's prompt and context
    let responseMessage: string
    
    try {
      responseMessage = await aiService.generateResponse(
        agent._id,
        agent.prompt,
        agent.contextDocuments || [],
        sanitizedMessage.trim(),
        {
          temperature: agent.settings?.temperature,
          maxTokens: agent.settings?.maxTokens,
          responseDelay: agent.settings?.responseDelay,
          connectionId: agent.settings?.connectionId?.toString(),
          modelId: agent.settings?.modelId
        },
        conversationHistory
      )
      
      console.log('AI response generated:', {
        agentName: agent.name,
        responseLength: responseMessage.length,
        originalMessageLength: sanitizedMessage.length
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
        userMessageLength: sanitizedMessage.length
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
        sanitizedAccountId,
        sanitizedConversationId,
        responseMessage,
        agent.settings?.chatwootApiKey
      )

      console.log('Response sent successfully to Chatwoot')

      return {
        success: true,
        message: 'Webhook processed and AI response sent',
        data: {
          agentId: agent._id,
          agentName: agent.name,
          originalMessageLength: sanitizedMessage.length,
          responseLength: responseMessage.length,
          conversationId: sanitizedConversationId || 0,
          accountId: sanitizedAccountId,
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
          originalMessageLength: sanitizedMessage.length,
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