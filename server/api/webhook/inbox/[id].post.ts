import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import chatwootService from '~/server/services/chatwootService'
import aiService from '~/server/services/aiService'
import * as crypto from 'crypto'

// Type definitions for better type safety
interface ProcessingResult {
  success: boolean
  agentId?: string
  agentName?: string
  agentType?: string
  response?: string
  error?: string
  processedAt?: string
  messageSent?: boolean
  sendError?: string
  message?: string
}

interface ErrorResult {
  stage: string
  error: string
  agentName?: string
}

interface WebhookPayload {
  event: string
  test?: boolean
  content?: string
  message_type?: string
  id?: string
  conversation?: {
    id: number
    account_id: number
  }
  account?: {
    id: number
  }
}

// Helper function to validate webhook signature
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false
  }
  
  // Calculate expected signature using HMAC-SHA256 (standard webhook format)
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  // Handle both formats: "sha256=hash" and just "hash"
  const normalizedSignature = signature.startsWith('sha256=') 
    ? signature.substring(7) 
    : signature
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(normalizedSignature, 'hex')
  )
}

// Helper function to process agent with proper error handling
async function processWithAgent(agent: any, payload: WebhookPayload, config: any = {}): Promise<ProcessingResult> {
  try {
    
    // Extract message content like the agent handler does
    const messageContent = payload.content || ''
    const conversationObj = payload.conversation
    const accountId = payload.account?.id || conversationObj?.account_id || 1
    const conversationId = conversationObj?.id || 0

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
    
    // Get conversation history like the agent handler does
    let conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
    
    try {
      const messages = await chatwootService.getConversationMessages(
        accountId,
        conversationId,
        config.chatwootApiKey || agent.settings?.chatwootApiKey
      )
      
      if (messages && Array.isArray(messages)) {
        conversationHistory = messages
          .filter(msg => 
            msg.content && 
            msg.content.trim() && 
            msg.content !== messageContent.trim() && // Exclude current message
            msg.id !== payload.id // Exclude current message by ID too
          )
          .slice(-10) // Get last 10 messages for context
          .map((msg): { role: 'user' | 'assistant', content: string } => {
            const isIncoming = msg.message_type === 0 || 
                              msg.message_type === 'incoming' || 
                              msg.sender_type === 'Contact'
            const role: 'user' | 'assistant' = isIncoming ? 'user' : 'assistant'
            return {
              role,
              content: msg.content.trim()
            }
          })
          .filter(msg => msg.content.length > 0)
          
        console.log(`Retrieved ${conversationHistory.length} previous messages for context`)
      }
    } catch (historyError) {
      console.warn(`Failed to get conversation history for agent ${agent.name}:`, historyError)
      conversationHistory = []
    }
    
    // Process with AI service  
    const response = await aiService.generateResponse(
      agent._id,
      agent.prompt,
      agent.contextDocuments || [],
      messageContent.trim(),
      {
        ...agent.settings,
        ...config, // Inbox-specific overrides
        temperature: agent.settings?.temperature,
        maxTokens: agent.settings?.maxTokens,
        responseDelay: agent.settings?.responseDelay,
        connectionId: agent.settings?.connectionId?.toString(),
        modelId: agent.settings?.modelId
      },
      conversationHistory
    )
    
    return {
      success: true,
      agentId: agent._id,
      agentName: agent.name,
      agentType: agent.agentType,
      response: response,
      processedAt: new Date().toISOString()
    }
    
  } catch (error: any) {
    console.error(`Error processing with agent ${agent.name}:`, error)
    return {
      success: false,
      agentId: agent._id,
      agentName: agent.name,
      agentType: agent.agentType,
      error: error.message,
      processedAt: new Date().toISOString()
    }
  }
}

export default defineEventHandler(async (event) => {
  console.log("=================== webhook/inbox");
  console.log(event);
  
  
  try {
    const inboxId = getRouterParam(event, 'id')
    if (!inboxId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Inbox ID is required'
      })
    }

    // Get and validate payload
    const payload = await readBody(event)
    const signature = getHeader(event, 'X-Webhook-Secret') || getHeader(event, 'x-webhook-secret')

    // Load inbox with populated agents
    const inbox = await Inbox.findById(inboxId)
      .populate('responseAgent.agentId')
      .populate('agents.agentId')

    if (!inbox || !inbox.isActive) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found or inactive'
      })
    }

    // Optional signature validation - only validate if both secret and signature are provided
    if (!payload.test && inbox.webhookSecret && signature) {
      const payloadString = JSON.stringify(payload)
      
      if (!validateWebhookSignature(payloadString, signature, inbox.webhookSecret)) {
        console.warn(`Invalid webhook signature for inbox ${inboxId}`)
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid webhook signature'
        })
      }
    } else if (inbox.webhookSecret && !signature) {
      console.log(`Webhook secret configured but no signature provided - processing without validation for inbox ${inboxId}`)
    } else {
      console.log(`Processing webhook without signature validation for inbox ${inboxId}`)
    }

    console.log(`Processing webhook for inbox ${inbox.name} (${inboxId}), event: ${payload.event}`)

    // Only process message events for now
    if (payload.event !== 'message_created') {
      return {
        success: true,
        message: `Event ${payload.event} acknowledged but not processed`,
        data: { event: payload.event, inbox: inbox.name }
      }
    }

    const processingResults: {
      preProcess: ProcessingResult[]
      response: ProcessingResult | null
      mainProcess: ProcessingResult[]
      postProcess: ProcessingResult[]
      errors: ErrorResult[]
    } = {
      preProcess: [],
      response: null,
      mainProcess: [],
      postProcess: [],
      errors: []
    }

    // Get all active agents sorted by priority
    const sortedAgents = inbox.agents
      .filter((a: any) => a.isActive && a.agentId) // Ensure agent exists
      .sort((a: any, b: any) => a.priority - b.priority)

    // Define agent arrays
    const preProcessAgents = sortedAgents.filter((a: any) => a.priority < 100)
    const mainAgents = sortedAgents.filter((a: any) => a.priority >= 100 && a.priority < 200)
    const postProcessAgents = sortedAgents.filter((a: any) => a.priority >= 200)

    try {
      // 1. Pre-processing agents (priority < 100) - Sequential
      console.log(`Processing ${preProcessAgents.length} pre-process agents`)
      
      for (const agentAssignment of preProcessAgents) {
        const result = await processWithAgent(
          agentAssignment.agentId, 
          payload, 
          agentAssignment.config
        )
        processingResults.preProcess.push(result)
      }

      // 2. Response agent (if configured)
      if (inbox.responseAgent?.agentId) {
        console.log(`Processing response agent: ${inbox.responseAgent.agentId.name}`)
        
        const responseResult = await processWithAgent(
          inbox.responseAgent.agentId,
          payload,
          inbox.responseAgent.config
        )

        console.log(`Response result: ${JSON.stringify(responseResult)}`)
        
        processingResults.response = responseResult

        // Send response to Chatwoot if successful
        if (responseResult.success && responseResult.response && payload.conversation?.id) {
          try {
            const accountId = payload.account?.id || payload.conversation?.account_id || 1
            const conversationId = payload.conversation?.id || 0
            const apiKey = inbox.responseAgent.config?.chatwootApiKey || 
                          inbox.responseAgent.agentId.settings?.chatwootApiKey ||
                          inbox.chatwoot?.apiKey

            await chatwootService.sendMessage(
              accountId,
              conversationId,
              responseResult.response,
              apiKey
            )
            
            ;(responseResult as any).messageSent = true
          } catch (sendError: any) {
            console.error('Failed to send response to Chatwoot:', sendError)
            ;(responseResult as any).sendError = sendError.message
            processingResults.errors.push({
              stage: 'response_send',
              error: sendError.message,
              agentName: inbox.responseAgent.agentId.name
            })
          }
        }
      }

      // 3. Main processing agents (priority 100-199) - Parallel
      console.log(`Processing ${mainAgents.length} main agents in parallel`)
      
      if (mainAgents.length > 0) {
        const mainPromises = mainAgents.map((agentAssignment: any) =>
          processWithAgent(agentAssignment.agentId, payload, agentAssignment.config)
        )
        
        const mainResults = await Promise.allSettled(mainPromises)
        processingResults.mainProcess = mainResults.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            const agentName = mainAgents[index].agentId.name
            console.error(`Main agent ${agentName} failed:`, result.reason)
            return {
              success: false,
              agentId: mainAgents[index].agentId._id,
              agentName: agentName,
              agentType: mainAgents[index].agentId.agentType,
              error: result.reason.message,
              processedAt: new Date().toISOString()
            }
          }
        })
      }

      // 4. Post-processing agents (priority >= 200) - Sequential
      console.log(`Processing ${postProcessAgents.length} post-process agents`)
      
      for (const agentAssignment of postProcessAgents) {
        const result = await processWithAgent(
          agentAssignment.agentId,
          payload,
          agentAssignment.config
        )
        processingResults.postProcess.push(result)
      }

    } catch (pipelineError: any) {
      console.error('Pipeline processing error:', pipelineError)
      processingResults.errors.push({
        stage: 'pipeline',
        error: pipelineError.message
      })
    }

    // Calculate summary
    const totalAgents = preProcessAgents.length + (inbox.responseAgent?.agentId ? 1 : 0) + 
                       mainAgents.length + postProcessAgents.length
    const successfulAgents = [
      ...processingResults.preProcess,
      ...(processingResults.response ? [processingResults.response] : []),
      ...processingResults.mainProcess,
      ...processingResults.postProcess
    ].filter((r: ProcessingResult) => r.success).length

    return {
      success: true,
      message: `Webhook processed successfully`,
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        event: payload.event,
        processing: {
          totalAgents,
          successfulAgents,
          failedAgents: totalAgents - successfulAgents,
          results: processingResults
        },
        processedAt: new Date().toISOString()
      }
    }

  } catch (error: any) {
    console.error('Webhook processing error:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process webhook'
    })
  }
})