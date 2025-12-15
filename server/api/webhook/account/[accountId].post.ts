import Inbox from '~/server/models/Inbox'
import workflowEngine from '~/server/services/workflowEngine'
import chatwootService from '~/server/services/chatwootService'

export default defineEventHandler(async (event) => {
  try {
    const accountId = parseInt(getRouterParam(event, 'accountId') || '')
    if (!accountId || isNaN(accountId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid account ID is required'
      })
    }

    const payload = await readBody(event)

    // Extract inbox ID from payload (different locations for different events)
    const inboxId = payload.inbox?.id || payload.inbox_id
    if (!inboxId) {
      console.log(`Account ${accountId} webhook: No inbox ID in payload, event: ${payload.event}`)
      return {
        success: true,
        message: 'No inbox ID in payload',
        data: { event: payload.event, accountId }
      }
    }

    // Look up inbox by Chatwoot IDs
    const inbox = await Inbox.findOne({ accountId, inboxId, isActive: true })
      .populate('agents.agentId')

    if (!inbox) {
      console.log(`Account ${accountId} webhook: Inbox ${inboxId} not found or inactive in Agent AI`)
      return {
        success: true,
        message: 'Inbox not registered or inactive in Agent AI',
        data: { event: payload.event, accountId, inboxId }
      }
    }

    console.log(`Account ${accountId} webhook: Processing event ${payload.event} for inbox ${inbox.name}`)

    // Handle conversation_created - open if not already open (covers bot still active scenario)
    if (payload.event === 'conversation_created') {
      const conversationId = payload.id
      const status = payload.status
      if (conversationId && status !== 'open') {
        try {
          console.log(`Opening conversation ${conversationId} (current status: ${status})`)
          await chatwootService.updateConversationStatus(
            accountId,
            conversationId,
            'open',
            inbox.chatwoot?.apiKey
          )
          console.log(`Successfully opened conversation ${conversationId}`)
        } catch (err: any) {
          console.warn(`Failed to open conversation ${conversationId}:`, err.message)
        }
      }
      return {
        success: true,
        message: 'Conversation created event processed',
        data: { event: payload.event, inbox: inbox.name, conversationId, opened: status !== 'open' }
      }
    }

    // Only process message_created events for AI response
    if (payload.event !== 'message_created') {
      return {
        success: true,
        message: `Event ${payload.event} acknowledged but not processed`,
        data: { event: payload.event, inbox: inbox.name }
      }
    }

    // Skip outgoing or template messages
    if (payload.message_type === 'outgoing' || payload.message_type === 'template') {
      return {
        success: true,
        message: `Skipped ${payload.message_type} message`,
        data: { event: payload.event, inbox: inbox.name, messageType: payload.message_type, skipped: true }
      }
    }

    // Skip empty messages
    if (!payload.content || !payload.content.trim()) {
      return {
        success: true,
        message: 'Skipped empty message',
        data: { event: payload.event, inbox: inbox.name, skipped: true }
      }
    }

    // Check if inbox has agents assigned
    const activeAgents = inbox.agents?.filter((a: any) => a.isActive) || []
    if (activeAgents.length === 0) {
      console.log(`Inbox ${inbox.name} has no active agents, skipping AI response`)
      return {
        success: true,
        message: 'No active agents assigned to inbox',
        data: { event: payload.event, inbox: inbox.name, skipped: true }
      }
    }

    // Process with workflow system
    const workflowResults = await workflowEngine.processEvent({
      type: payload.event,
      data: {
        message: payload.content,
        message_id: payload.id,
        message_type: payload.message_type,
        conversation_id: payload.conversation?.id,
        account_id: accountId,
        sender: payload.sender,
        conversation: payload.conversation,
        account: payload.account,
        inbox: payload.inbox,
        contact: payload.contact,
        assignee: payload.assignee,
        timestamp: new Date().toISOString()
      },
      metadata: {
        inboxId: inbox._id.toString(),
        source: 'account-webhook'
      }
    }, inbox._id.toString())

    return {
      success: true,
      message: 'Webhook processed successfully',
      data: {
        workflows: workflowResults,
        summary: {
          workflowsExecuted: workflowResults.length,
          workflowsSuccessful: workflowResults.filter((w: any) => w.success).length
        }
      }
    }

  } catch (error: any) {
    console.error('Account webhook processing error:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process webhook'
    })
  }
})

/**
 * Example payloads:
 *
 * {
   additional_attributes: {
     browser: {
       device_name: 'Unknown',
       browser_name: 'Chrome',
       platform_name: 'macOS',
       browser_version: '143.0.0.0',
       platform_version: '10.15.7'
     },
     referer: null,
     initiated_at: {
       timestamp: 'Mon Dec 15 2025 11:29:24 GMT+0100 (Central European Standard Time)'
     },
     browser_language: 'en'
   },
   can_reply: true,
   channel: 'Channel::WebWidget',
   contact_inbox: {
     id: 123,
     contact_id: 121,
     inbox_id: 3,
     source_id: '62cc22a4-d619-4f23-aa10-c79b29868629',
     created_at: '2025-12-15T10:28:14.991Z',
     updated_at: '2025-12-15T10:28:14.991Z',
     hmac_verified: false,
     pubsub_token: 'VWFfvt5MYtSqyVWaMs7wzgTc'
   },
   id: 89,
   inbox_id: 3,
   messages: [
     {
       id: 734,
       content: 'aoeu',
       account_id: 2,
       inbox_id: 3,
       conversation_id: 89,
       message_type: 0,
       created_at: 1765794564,
       updated_at: '2025-12-15T10:29:24.237Z',
       private: false,
       status: 'sent',
       source_id: null,
       content_type: 'text',
       content_attributes: [Object],
       sender_type: 'Contact',
       sender_id: 121,
       external_source_ids: {},
       additional_attributes: {},
       processed_message_content: 'aoeu',
       sentiment: {},
       conversation: [Object],
       sender: [Object]
     }
   ],
   labels: [],
   meta: {
     sender: {
       additional_attributes: {},
       custom_attributes: {},
       email: null,
       id: 121,
       identifier: null,
       name: 'frosty-moon-407',
       phone_number: null,
       thumbnail: '',
       blocked: false,
       type: 'contact'
     },
     assignee: {
       id: 1,
       name: 'Corsac',
       available_name: 'Corsac',
       avatar_url: 'http://0.0.0.0:3000/rails/active_storage/representations/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBCZz09IiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--20c7a30ac9d5feb1fc43a28bea5d667e4ab020ae/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaDdCem9MWm05eWJXRjBTU0lJY0c1bkJqb0dSVlE2RTNKbGMybDZaVjkwYjE5bWFXeHNXd2RwQWZvdyIsImV4cCI6bnVsbCwicHVyIjoidmFyaWF0aW9uIn19--3460abeb7e7f5a9ecaf21dd9a8774a8fd31eb390/36b9a876445155d96082a10acd86dc7b.png',
       type: 'user',
       availability_status: 'online',
       thumbnail: 'http://0.0.0.0:3000/rails/active_storage/representations/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBCZz09IiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--20c7a30ac9d5feb1fc43a28bea5d667e4ab020ae/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaDdCem9MWm05eWJXRjBTU0lJY0c1bkJqb0dSVlE2RTNKbGMybDZaVjkwYjE5bWFXeHNXd2RwQWZvdyIsImV4cCI6bnVsbCwicHVyIjoidmFyaWF0aW9uIn19--3460abeb7e7f5a9ecaf21dd9a8774a8fd31eb390/36b9a876445155d96082a10acd86dc7b.png'
     },
     assignee_type: 'User',
     team: null,
     hmac_verified: false
   },
   status: 'open',
   custom_attributes: {},
   snoozed_until: null,
   unread_count: 1,
   first_reply_created_at: null,
   priority: null,
   waiting_since: 1765794564,
   agent_last_seen_at: 0,
   contact_last_seen_at: 0,
   last_activity_at: 1765794564,
   timestamp: 1765794564,
   created_at: 1765794564,
   updated_at: 1765794564.238241,
   event: 'conversation_created'
 }
 Account 2 webhook: No inbox ID in payload, event: conversation_created
 {
   account: { id: 2, name: 'BLUEBIRD Account' },
   additional_attributes: {},
   content_attributes: { in_reply_to: null },
   content_type: 'text',
   content: 'aoeu',
   conversation: {
     additional_attributes: {
       browser: [Object],
       referer: null,
       initiated_at: [Object],
       browser_language: 'en'
     },
     can_reply: true,
     channel: 'Channel::WebWidget',
     contact_inbox: {
       id: 123,
       contact_id: 121,
       inbox_id: 3,
       source_id: '62cc22a4-d619-4f23-aa10-c79b29868629',
       created_at: '2025-12-15T10:28:14.991Z',
       updated_at: '2025-12-15T10:28:14.991Z',
       hmac_verified: false,
       pubsub_token: 'VWFfvt5MYtSqyVWaMs7wzgTc'
     },
     id: 89,
     inbox_id: 3,
     messages: [ [Object] ],
     labels: [],
     meta: {
       sender: [Object],
       assignee: [Object],
       assignee_type: 'User',
       team: null,
       hmac_verified: false
     },
     status: 'open',
     custom_attributes: {},
     snoozed_until: null,
     unread_count: 1,
     first_reply_created_at: null,
     priority: null,
     waiting_since: 1765794564,
     agent_last_seen_at: 0,
     contact_last_seen_at: 0,
     last_activity_at: 1765794564,
     timestamp: 1765794564,
     created_at: 1765794564,
     updated_at: 1765794564.238241
   },
   created_at: '2025-12-15T10:29:24.237Z',
   id: 734,
   inbox: { id: 3, name: 'Test Webhook' },
   message_type: 'incoming',
   private: false,
   sender: {
     account: { id: 2, name: 'BLUEBIRD Account' },
     additional_attributes: {},
     avatar: '',
     custom_attributes: {},
     email: null,
     id: 121,
     identifier: null,
     name: 'frosty-moon-407',
     phone_number: null,
     thumbnail: '',
     blocked: false
   },
   source_id: null,
   event: 'message_created'
 }
 
 */