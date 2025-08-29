import Inbox from '~/server/models/Inbox'
import agentProcessingEngine from '~/server/services/agentProcessingEngine'
import * as crypto from 'crypto'

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

export default defineEventHandler(async (event) => {
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

    // Skip if message is outgoing or template (from agent/bot/system)
    if (payload.message_type === 'outgoing' || payload.message_type === 'template') {
      return {
        success: true,
        message: `Skipped ${payload.message_type} message`,
        data: { 
          event: payload.event, 
          inbox: inbox.name,
          messageType: payload.message_type,
          skipped: true
        }
      }
    }

    // Skip if no message content
    if (!payload.content || !payload.content.trim()) {
      return {
        success: true,
        message: 'Skipped empty message',
        data: { 
          event: payload.event, 
          inbox: inbox.name,
          skipped: true
        }
      }
    }

    // Use the centralized agent processing engine instead of duplicated logic
    const processingContext = {
      message: payload.content || '',
      message_id: payload.id,
      message_type: payload.message_type,
      conversation_id: payload.conversation?.id,
      account_id: payload.account?.id || payload.conversation?.account_id,
      event_type: payload.event,
      timestamp: new Date().toISOString()
    }

    const pipelineResult = await agentProcessingEngine.executeCompletePipeline(
      inboxId,
      processingContext
    )

    return {
      success: true,
      message: `Webhook processed successfully`,
      data: pipelineResult
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