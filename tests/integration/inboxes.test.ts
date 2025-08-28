import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupNuxtApp, resetDatabase, createTestUser, createTestAgent } from '../setup'

describe('Inboxes API Integration Tests', () => {
  let nuxtApp: any
  let testUser: any
  let testAgent: any

  beforeEach(async () => {
    nuxtApp = await setupNuxtApp()
    await resetDatabase()
    testUser = await createTestUser()
    testAgent = await createTestAgent(testUser._id)
  })

  afterEach(async () => {
    await resetDatabase()
  })

  describe('Inbox CRUD Operations', () => {
    it('should create a new inbox successfully', async () => {
      const inboxData = {
        name: 'Test Inbox',
        channelType: 'web_widget',
        accountId: 1,
        inboxId: 123,
        chatwoot: {
          apiKey: 'test-api-key'
        },
        settings: {
          processDelay: 0,
          enableLogging: true,
          enableAnalytics: true
        }
      }

      const response = await $fetch('/api/inboxes', {
        method: 'POST',
        body: inboxData,
        headers: {
          'user-id': testUser._id
        }
      })

      expect(response.success).toBe(true)
      expect(response.data.inbox).toBeDefined()
      expect(response.data.inbox.name).toBe(inboxData.name)
      expect(response.data.inbox.channelType).toBe(inboxData.channelType)
      expect(response.data.inbox.accountId).toBe(inboxData.accountId)
      expect(response.data.inbox.inboxId).toBe(inboxData.inboxId)
      expect(response.data.inbox.webhookUrl).toMatch(/^\/api\/webhook\/inbox\/[a-f0-9]+$/)
      expect(response.data.inbox.webhookSecret).toBeDefined()
    })

    it('should prevent duplicate inbox creation', async () => {
      const inboxData = {
        name: 'Test Inbox',
        channelType: 'web_widget',
        accountId: 1,
        inboxId: 123
      }

      // Create first inbox
      await $fetch('/api/inboxes', {
        method: 'POST',
        body: inboxData,
        headers: { 'user-id': testUser._id }
      })

      // Try to create duplicate
      await expect(
        $fetch('/api/inboxes', {
          method: 'POST',
          body: inboxData,
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/already exists/)
    })

    it('should fetch inbox list with pagination', async () => {
      // Create multiple inboxes
      for (let i = 1; i <= 5; i++) {
        await $fetch('/api/inboxes', {
          method: 'POST',
          body: {
            name: `Test Inbox ${i}`,
            channelType: 'web_widget',
            accountId: 1,
            inboxId: 100 + i
          },
          headers: { 'user-id': testUser._id }
        })
      }

      const response = await $fetch('/api/inboxes', {
        query: { page: 1, limit: 3 },
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
      expect(response.data.inboxes).toHaveLength(3)
      expect(response.data.pagination.total).toBe(5)
      expect(response.data.pagination.pages).toBe(2)
    })

    it('should update an existing inbox', async () => {
      // Create inbox
      const createResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Original Name',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })

      const inboxId = createResponse.data.inbox._id

      // Update inbox
      const updateResponse = await $fetch(`/api/inboxes/${inboxId}`, {
        method: 'PUT',
        body: {
          name: 'Updated Name',
          settings: {
            processDelay: 5,
            enableLogging: false
          }
        },
        headers: { 'user-id': testUser._id }
      })

      expect(updateResponse.success).toBe(true)
      expect(updateResponse.data.inbox.name).toBe('Updated Name')
      expect(updateResponse.data.inbox.settings.processDelay).toBe(5)
      expect(updateResponse.data.inbox.settings.enableLogging).toBe(false)
    })

    it('should delete an inbox', async () => {
      // Create inbox
      const createResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Test Inbox',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })

      const inboxId = createResponse.data.inbox._id

      // Delete inbox
      const deleteResponse = await $fetch(`/api/inboxes/${inboxId}`, {
        method: 'DELETE',
        headers: { 'user-id': testUser._id }
      })

      expect(deleteResponse.success).toBe(true)

      // Verify it's deleted
      await expect(
        $fetch(`/api/inboxes/${inboxId}`, {
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/not found/)
    })
  })

  describe('Response Agent Management', () => {
    let inbox: any
    let responseAgent: any

    beforeEach(async () => {
      // Create inbox
      const inboxResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Test Inbox',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })
      inbox = inboxResponse.data.inbox

      // Create response agent
      responseAgent = await createTestAgent(testUser._id, 'response')
    })

    it('should assign response agent to inbox', async () => {
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'PUT',
        body: {
          agentId: responseAgent._id,
          config: { temperature: 0.7 }
        },
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
      expect(response.data.responseAgent.agentId._id).toBe(responseAgent._id.toString())
      expect(response.data.responseAgent.config.temperature).toBe(0.7)
    })

    it('should prevent non-response agents from being assigned as response agent', async () => {
      const analyticsAgent = await createTestAgent(testUser._id, 'analytics')

      await expect(
        $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
          method: 'PUT',
          body: { agentId: analyticsAgent._id },
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/Only response agents/)
    })

    it('should remove response agent from inbox', async () => {
      // First assign
      await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'PUT',
        body: { agentId: responseAgent._id },
        headers: { 'user-id': testUser._id }
      })

      // Then remove
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'DELETE',
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
    })
  })

  describe('Processing Pipeline Management', () => {
    let inbox: any
    let analyticsAgent: any
    let moderationAgent: any

    beforeEach(async () => {
      // Create inbox
      const inboxResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Test Inbox',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })
      inbox = inboxResponse.data.inbox

      // Create processing agents
      analyticsAgent = await createTestAgent(testUser._id, 'analytics')
      moderationAgent = await createTestAgent(testUser._id, 'moderation')
    })

    it('should add agent to processing pipeline', async () => {
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: {
          agentId: analyticsAgent._id,
          priority: 100,
          config: { model: 'gpt-4' }
        },
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
      expect(response.data.addedAgent.agentId).toBe(analyticsAgent._id.toString())
      expect(response.data.addedAgent.priority).toBe(100)
      expect(response.data.addedAgent.config.model).toBe('gpt-4')
    })

    it('should prevent response agents from being added to processing pipeline', async () => {
      const responseAgent = await createTestAgent(testUser._id, 'response')

      await expect(
        $fetch(`/api/inboxes/${inbox._id}/agents`, {
          method: 'POST',
          body: { agentId: responseAgent._id },
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/Response agents must be assigned as response agent/)
    })

    it('should update agent configuration in processing pipeline', async () => {
      // Add agent
      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: {
          agentId: analyticsAgent._id,
          priority: 100
        },
        headers: { 'user-id': testUser._id }
      })

      // Update agent
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents/${analyticsAgent._id}`, {
        method: 'PUT',
        body: {
          priority: 150,
          isActive: false,
          config: { newSetting: 'value' }
        },
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
      expect(response.data.updatedAgent.priority).toBe(150)
      expect(response.data.updatedAgent.isActive).toBe(false)
      expect(response.data.updatedAgent.config.newSetting).toBe('value')
    })

    it('should remove agent from processing pipeline', async () => {
      // Add agent
      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: analyticsAgent._id },
        headers: { 'user-id': testUser._id }
      })

      // Remove agent
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents/${analyticsAgent._id}`, {
        method: 'DELETE',
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
    })

    it('should maintain priority order when adding multiple agents', async () => {
      // Add agents with different priorities
      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: moderationAgent._id, priority: 50 },
        headers: { 'user-id': testUser._id }
      })

      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: analyticsAgent._id, priority: 25 },
        headers: { 'user-id': testUser._id }
      })

      // Get agents list
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        headers: { 'user-id': testUser._id }
      })

      const agents = response.data.agents
      expect(agents[0].priority).toBe(25) // Analytics agent should be first
      expect(agents[1].priority).toBe(50) // Moderation agent should be second
    })
  })

  describe('Webhook Processing', () => {
    let inbox: any
    let responseAgent: any
    let analyticsAgent: any

    beforeEach(async () => {
      // Create inbox
      const inboxResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Test Inbox',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })
      inbox = inboxResponse.data.inbox

      // Create and assign agents
      responseAgent = await createTestAgent(testUser._id, 'response')
      analyticsAgent = await createTestAgent(testUser._id, 'analytics')

      await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'PUT',
        body: { agentId: responseAgent._id },
        headers: { 'user-id': testUser._id }
      })

      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: analyticsAgent._id, priority: 100 },
        headers: { 'user-id': testUser._id }
      })
    })

    it('should process webhook successfully with test payload', async () => {
      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: {
          message: 'Hello, this is a test message',
          conversation_id: 456,
          account_id: 1,
          sender: {
            id: 1,
            name: 'Test User'
          }
        },
        timestamp: new Date().toISOString()
      }

      // Extract inbox webhook ID from URL
      const webhookId = inbox.webhookUrl.split('/').pop()

      const response = await $fetch(`/api/webhook/inbox/${webhookId}`, {
        method: 'POST',
        body: webhookPayload
      })

      expect(response.success).toBe(true)
      expect(response.data.processing.totalAgents).toBe(2) // Response + analytics
      expect(response.data.processing.results.response).toBeDefined()
      expect(response.data.processing.results.mainProcess).toHaveLength(1)
    })

    it('should handle webhook with invalid inbox ID', async () => {
      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: { message: 'Test' }
      }

      await expect(
        $fetch('/api/webhook/inbox/invalid-id', {
          method: 'POST',
          body: webhookPayload
        })
      ).rejects.toThrowError(/not found/)
    })

    it('should skip processing for inactive inbox', async () => {
      // Deactivate inbox
      await $fetch(`/api/inboxes/${inbox._id}`, {
        method: 'PUT',
        body: { isActive: false },
        headers: { 'user-id': testUser._id }
      })

      const webhookPayload = {
        event: 'message_created',
        test: true,
        data: { message: 'Test' }
      }

      const webhookId = inbox.webhookUrl.split('/').pop()

      await expect(
        $fetch(`/api/webhook/inbox/${webhookId}`, {
          method: 'POST',
          body: webhookPayload
        })
      ).rejects.toThrowError(/inactive/)
    })
  })

  describe('Agent Constraints Validation', () => {
    let inbox: any
    let responseAgent1: any
    let responseAgent2: any

    beforeEach(async () => {
      // Create inbox
      const inboxResponse = await $fetch('/api/inboxes', {
        method: 'POST',
        body: {
          name: 'Test Inbox',
          channelType: 'web_widget',
          accountId: 1,
          inboxId: 123
        },
        headers: { 'user-id': testUser._id }
      })
      inbox = inboxResponse.data.inbox

      // Create response agents
      responseAgent1 = await createTestAgent(testUser._id, 'response')
      responseAgent2 = await createTestAgent(testUser._id, 'response')
    })

    it('should enforce single response agent constraint', async () => {
      // Assign first response agent
      await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'PUT',
        body: { agentId: responseAgent1._id },
        headers: { 'user-id': testUser._id }
      })

      // Try to assign second response agent (should replace first)
      const response = await $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
        method: 'PUT',
        body: { agentId: responseAgent2._id },
        headers: { 'user-id': testUser._id }
      })

      expect(response.success).toBe(true)
      expect(response.data.responseAgent.agentId._id).toBe(responseAgent2._id.toString())
    })

    it('should prevent agent from being in both response and pipeline', async () => {
      // First add to pipeline
      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: responseAgent1._id },
        headers: { 'user-id': testUser._id }
      })

      // Then try to assign as response agent
      await expect(
        $fetch(`/api/inboxes/${inbox._id}/agents/response`, {
          method: 'PUT',
          body: { agentId: responseAgent1._id },
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/cannot be in both/)
    })

    it('should prevent duplicate agent assignment in pipeline', async () => {
      const analyticsAgent = await createTestAgent(testUser._id, 'analytics')

      // Add agent first time
      await $fetch(`/api/inboxes/${inbox._id}/agents`, {
        method: 'POST',
        body: { agentId: analyticsAgent._id },
        headers: { 'user-id': testUser._id }
      })

      // Try to add same agent again
      await expect(
        $fetch(`/api/inboxes/${inbox._id}/agents`, {
          method: 'POST',
          body: { agentId: analyticsAgent._id },
          headers: { 'user-id': testUser._id }
        })
      ).rejects.toThrowError(/already assigned/)
    })
  })
})