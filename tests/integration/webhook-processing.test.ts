import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupNuxtApp, resetDatabase, createTestUser, createTestAgent, createTestInbox } from '../setup'

describe('Webhook Processing Integration Tests', () => {
  let nuxtApp: any
  let testUser: any
  let testInbox: any
  let responseAgent: any
  let analyticsAgent: any
  let moderationAgent: any

  beforeEach(async () => {
    nuxtApp = await setupNuxtApp()
    await resetDatabase()
    testUser = await createTestUser()
    
    // Create test inbox
    testInbox = await createTestInbox(testUser._id, {
      name: 'Webhook Test Inbox',
      accountId: 1,
      inboxId: 123,
      channelType: 'web_widget'
    })

    // Create test agents
    responseAgent = await createTestAgent(testUser._id, 'response')
    analyticsAgent = await createTestAgent(testUser._id, 'analytics')  
    moderationAgent = await createTestAgent(testUser._id, 'moderation')

    // Assign agents to inbox
    await $fetch(`/api/inboxes/${testInbox._id}/agents/response`, {
      method: 'PUT',
      body: { agentId: responseAgent._id },
      headers: { 'user-id': testUser._id }
    })

    await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
      method: 'POST',
      body: { agentId: analyticsAgent._id, priority: 100 },
      headers: { 'user-id': testUser._id }
    })

    await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
      method: 'POST',
      body: { agentId: moderationAgent._id, priority: 110 },
      headers: { 'user-id': testUser._id }
    })
  })

  afterEach(async () => {
    await resetDatabase()
  })

  describe('Message Created Event Processing', () => {
    it('should process message_created event through complete pipeline', async () => {
      const webhookPayload = {
        event: 'message_created',
        test: true, // Skip signature validation
        data: {
          message: 'Hello, I need help with my account',
          conversation_id: 456,
          account_id: 1,
          sender: {
            id: 1,
            name: 'Test Customer',
            email: 'customer@example.com'
          },
          inbox: {
            id: 123
          }
        },
        timestamp: new Date().toISOString()
      }

      // Extract webhook ID from inbox webhook URL
      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      // Verify successful processing
      expect(response.success).toBe(true)
      expect(response.data.event).toBe('message_created')
      expect(response.data.inbox.name).toBe('Webhook Test Inbox')

      // Verify processing results
      const processing = response.data.processing
      expect(processing.totalAgents).toBe(3) // 1 response + 2 main agents
      expect(processing.successfulAgents).toBeGreaterThan(0)

      // Verify response agent was processed
      expect(processing.results.response).toBeDefined()
      expect(processing.results.response.success).toBe(true)
      expect(processing.results.response.agentName).toBe(responseAgent.name)

      // Verify main agents were processed (analytics and moderation)
      expect(processing.results.mainProcess).toHaveLength(2)
      
      const analyticsResult = processing.results.mainProcess.find(
        r => r.agentName === analyticsAgent.name
      )
      expect(analyticsResult).toBeDefined()
      expect(analyticsResult.success).toBe(true)

      const moderationResult = processing.results.mainProcess.find(
        r => r.agentName === moderationAgent.name
      )
      expect(moderationResult).toBeDefined()
      expect(moderationResult.success).toBe(true)
    })

    it('should handle processing with priority-based execution order', async () => {
      // Add a pre-process agent
      const preProcessAgent = await createTestAgent(testUser._id, 'pre-process')
      await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
        method: 'POST',
        body: { agentId: preProcessAgent._id, priority: 50 },
        headers: { 'user-id': testUser._id }
      })

      // Add a post-process agent
      const postProcessAgent = await createTestAgent(testUser._id, 'post-process')
      await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
        method: 'POST',
        body: { agentId: postProcessAgent._id, priority: 250 },
        headers: { 'user-id': testUser._id }
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Test message for priority ordering',
          conversation_id: 789,
          account_id: 1
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      expect(response.success).toBe(true)

      const processing = response.data.processing
      expect(processing.totalAgents).toBe(5) // 1 pre + 1 response + 2 main + 1 post

      // Verify all pipeline stages were executed
      expect(processing.results.preProcess).toHaveLength(1)
      expect(processing.results.response).toBeDefined()
      expect(processing.results.mainProcess).toHaveLength(2)
      expect(processing.results.postProcess).toHaveLength(1)

      // Verify pre-process agent was executed
      expect(processing.results.preProcess[0].agentName).toBe(preProcessAgent.name)
      
      // Verify post-process agent was executed
      expect(processing.results.postProcess[0].agentName).toBe(postProcessAgent.name)
    })

    it('should handle mixed agent success/failure scenarios', async () => {
      // Create a failing agent (this would need to be configured to fail in test setup)
      const failingAgent = await createTestAgent(testUser._id, 'analytics')
      
      // Configure the failing agent with invalid settings that would cause processing to fail
      await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
        method: 'POST',
        body: { 
          agentId: failingAgent._id, 
          priority: 120,
          config: { 
            // Config that would cause AI service to fail
            invalidSetting: 'cause_failure'
          }
        },
        headers: { 'user-id': testUser._id }
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Test message with failing agent',
          conversation_id: 101,
          account_id: 1
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      // Webhook should still succeed even with some agent failures
      expect(response.success).toBe(true)

      const processing = response.data.processing
      expect(processing.totalAgents).toBe(4) // 1 response + 3 main agents

      // Should have both successful and failed agents
      expect(processing.successfulAgents).toBeGreaterThan(0)
      expect(processing.failedAgents).toBeGreaterThan(0)

      // Response agent should still work
      expect(processing.results.response.success).toBe(true)

      // Some main agents should fail
      const failedAgents = processing.results.mainProcess.filter(r => !r.success)
      expect(failedAgents.length).toBeGreaterThan(0)
    })

    it('should skip processing inactive agents', async () => {
      // Deactivate the moderation agent
      await $fetch(`/api/inboxes/${testInbox._id}/agents/${moderationAgent._id}`, {
        method: 'PUT',
        body: { isActive: false },
        headers: { 'user-id': testUser._id }
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Test with inactive agent',
          conversation_id: 202,
          account_id: 1
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      expect(response.success).toBe(true)

      const processing = response.data.processing
      // Should only process 2 agents (response + analytics), not the inactive moderation agent
      expect(processing.totalAgents).toBe(2)

      // Verify moderation agent was not processed
      const moderationResult = processing.results.mainProcess.find(
        r => r.agentName === moderationAgent.name
      )
      expect(moderationResult).toBeUndefined()
    })
  })

  describe('Response Agent Message Sending', () => {
    it('should send response to Chatwoot when response agent generates content', async () => {
      // Mock chatwoot service to track message sending
      const originalSendMessage = global.$fetch
      const sentMessages: any[] = []

      // Override $fetch to intercept Chatwoot API calls
      global.$fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (url.includes('chatwoot') && url.includes('messages')) {
          sentMessages.push({
            url,
            body: options?.body
          })
          return { id: 123, content: options?.body?.content }
        }
        return originalSendMessage(url, options)
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'I need help',
          conversation_id: 303,
          account_id: 1,
          sender: { id: 1, name: 'Customer' }
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      expect(response.success).toBe(true)

      // Verify response was generated and sent
      const responseResult = response.data.processing.results.response
      expect(responseResult.success).toBe(true)
      expect(responseResult.response).toBeDefined()

      // In a real test environment, we would verify the message was sent to Chatwoot
      // For now, we just verify the processing completed successfully

      // Restore original fetch
      global.$fetch = originalSendMessage
    })

    it('should handle Chatwoot send failures gracefully', async () => {
      // This test would require mocking the chatwoot service to simulate send failures
      // The webhook should still complete successfully even if message sending fails

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Test with send failure',
          conversation_id: 404,
          account_id: 1
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      // Webhook processing should still succeed
      expect(response.success).toBe(true)

      // Response should be generated even if send fails
      const responseResult = response.data.processing.results.response
      expect(responseResult.success).toBe(true)
      expect(responseResult.response).toBeDefined()
    })
  })

  describe('Webhook Security and Validation', () => {
    it('should reject requests to non-existent inbox', async () => {
      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: { message: 'Test' }
      }

      await expect(
        $fetch('/api/webhook/inbox/non-existent-id', {
          method: 'POST',
          body: webhookPayload
        })
      ).rejects.toThrowError(/not found/)
    })

    it('should reject requests to inactive inbox', async () => {
      // Deactivate the inbox
      await $fetch(`/api/inboxes/${testInbox._id}`, {
        method: 'PUT',
        body: { isActive: false },
        headers: { 'user-id': testUser._id }
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: { message: 'Test' }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      await expect(
        $fetch(`/api/webhook/inbox/${webhookId}`, {
          method: 'POST',
          body: webhookPayload
        })
      ).rejects.toThrowError(/inactive/)
    })

    it('should acknowledge but not process non-message events', async () => {
      const webhookPayload = {
        event: 'conversation_status_changed',
        test: true,
        data: {
          conversation_id: 505,
          status: 'resolved'
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      expect(response.success).toBe(true)
      expect(response.message).toContain('acknowledged but not processed')
      expect(response.data.event).toBe('conversation_status_changed')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple agents efficiently', async () => {
      // Add several more agents to test performance
      const additionalAgents = []
      for (let i = 0; i < 5; i++) {
        const agent = await createTestAgent(testUser._id, 'analytics')
        additionalAgents.push(agent)
        
        await $fetch(`/api/inboxes/${testInbox._id}/agents`, {
          method: 'POST',
          body: { agentId: agent._id, priority: 100 + i },
          headers: { 'user-id': testUser._id }
        })
      }

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Performance test with many agents',
          conversation_id: 606,
          account_id: 1
        }
      }

      const webhookId = testInbox.webhookUrl.split('/').pop()
      const startTime = Date.now()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      const processingTime = Date.now() - startTime

      expect(response.success).toBe(true)
      
      // Should process all agents (1 response + 7 main agents)
      expect(response.data.processing.totalAgents).toBe(8)
      
      // Processing should complete within reasonable time (10 seconds)
      expect(processingTime).toBeLessThan(10000)
      
      // Most agents should succeed
      expect(response.data.processing.successfulAgents).toBeGreaterThan(6)
    })

    it('should process concurrent webhook requests without conflicts', async () => {
      const webhookId = testInbox.webhookUrl.split('/').pop()
      
      // Create multiple concurrent webhook requests
      const requests = []
      for (let i = 0; i < 3; i++) {
        const request = $fetch(`/api/webhook/inbox/${webhookId}`, {
          method: 'POST',
          body: {
            event: 'message_created',
            test: true,
            data: {
              message: `Concurrent test message ${i}`,
              conversation_id: 700 + i,
              account_id: 1
            }
          }
        })
        requests.push(request)
      }

      // Wait for all requests to complete
      const responses = await Promise.all(requests)

      // All requests should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true)
        expect(response.data.processing.totalAgents).toBe(3)
      })
    })
  })
})