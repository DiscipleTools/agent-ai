import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import inboxService from '../../server/services/inboxService'
import Inbox from '../../server/models/Inbox'
import Agent from '../../server/models/Agent'

// Mock the models
vi.mock('../../server/models/Inbox')
vi.mock('../../server/models/Agent')
vi.mock('../../server/services/chatwootService')

describe('InboxService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createInbox', () => {
    it('should create inbox successfully', async () => {
      const mockInboxData = {
        name: 'Test Inbox',
        accountId: 1,
        inboxId: 123,
        channelType: 'web_widget',
        createdBy: 'user123'
      }

      const mockSavedInbox = {
        ...mockInboxData,
        _id: 'inbox123',
        save: vi.fn().mockResolvedValue(undefined),
        populate: vi.fn().mockResolvedValue(mockInboxData)
      }

      // Mock Inbox.findOne to return null (no existing inbox)
      vi.mocked(Inbox.findOne).mockResolvedValue(null)
      
      // Mock Inbox constructor
      vi.mocked(Inbox).mockImplementation(() => mockSavedInbox as any)

      const result = await inboxService.createInbox(mockInboxData)

      expect(Inbox.findOne).toHaveBeenCalledWith({
        accountId: mockInboxData.accountId,
        inboxId: mockInboxData.inboxId
      })
      expect(Inbox).toHaveBeenCalledWith(mockInboxData)
      expect(mockSavedInbox.save).toHaveBeenCalled()
      expect(mockSavedInbox.populate).toHaveBeenCalled()
      expect(result).toBe(mockInboxData)
    })

    it('should throw error for duplicate inbox', async () => {
      const mockInboxData = {
        accountId: 1,
        inboxId: 123
      }

      // Mock existing inbox
      vi.mocked(Inbox.findOne).mockResolvedValue({ _id: 'existing' } as any)

      await expect(inboxService.createInbox(mockInboxData)).rejects.toThrow(
        'Inbox already exists with this account ID and inbox ID'
      )
    })
  })

  describe('assignResponseAgent', () => {
    it('should assign response agent successfully', async () => {
      const inboxId = 'inbox123'
      const agentId = 'agent123'
      const config = { temperature: 0.7 }

      const mockAgent = {
        _id: agentId,
        agentType: 'response'
      }

      const mockInbox = {
        _id: inboxId,
        agents: [],
        assignResponseAgent: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        populate: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)
      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      const result = await inboxService.assignResponseAgent(inboxId, agentId, config)

      expect(Agent.findById).toHaveBeenCalledWith(agentId)
      expect(Inbox.findById).toHaveBeenCalledWith(inboxId)
      expect(mockInbox.assignResponseAgent).toHaveBeenCalledWith(agentId, config)
      expect(mockInbox.save).toHaveBeenCalled()
      expect(result).toBe(mockInbox)
    })

    it('should reject non-response agent for response assignment', async () => {
      const mockAgent = {
        _id: 'agent123',
        agentType: 'analytics'
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)

      await expect(
        inboxService.assignResponseAgent('inbox123', 'agent123', {})
      ).rejects.toThrow('Only response agents can be assigned as response agent')
    })

    it('should reject if agent is already in processing pipeline', async () => {
      const agentId = 'agent123'
      
      const mockAgent = {
        _id: agentId,
        agentType: 'response'
      }

      const mockInbox = {
        _id: 'inbox123',
        agents: [{ agentId: { toString: () => agentId } }]
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)
      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      await expect(
        inboxService.assignResponseAgent('inbox123', agentId, {})
      ).rejects.toThrow('Response agent cannot be in both response agent and agents array')
    })
  })

  describe('addAgent', () => {
    it('should add agent to processing pipeline successfully', async () => {
      const inboxId = 'inbox123'
      const agentId = 'agent123'
      const priority = 100
      const config = { model: 'gpt-4' }

      const mockAgent = {
        _id: agentId,
        agentType: 'analytics',
        name: 'Analytics Agent'
      }

      const mockInbox = {
        _id: inboxId,
        responseAgent: null,
        addAgent: vi.fn(),
        save: vi.fn().mockResolvedValue(undefined),
        populate: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)
      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      const result = await inboxService.addAgent(inboxId, agentId, priority, config)

      expect(Agent.findById).toHaveBeenCalledWith(agentId)
      expect(Inbox.findById).toHaveBeenCalledWith(inboxId)
      expect(mockInbox.addAgent).toHaveBeenCalledWith(
        agentId, 
        mockAgent.agentType, 
        mockAgent.name, 
        priority, 
        config
      )
      expect(mockInbox.save).toHaveBeenCalled()
      expect(result).toBe(mockInbox)
    })

    it('should reject response agents for processing pipeline', async () => {
      const mockAgent = {
        _id: 'agent123',
        agentType: 'response'
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)

      await expect(
        inboxService.addAgent('inbox123', 'agent123', 100, {})
      ).rejects.toThrow('Response agents must be assigned as response agent, not in agents array')
    })

    it('should reject if agent is already response agent', async () => {
      const agentId = 'agent123'
      
      const mockAgent = {
        _id: agentId,
        agentType: 'analytics'
      }

      const mockInbox = {
        _id: 'inbox123',
        responseAgent: { 
          agentId: { toString: () => agentId } 
        }
      }

      vi.mocked(Agent.findById).mockResolvedValue(mockAgent as any)
      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      await expect(
        inboxService.addAgent('inbox123', agentId, 100, {})
      ).rejects.toThrow('Agent is already assigned as response agent')
    })
  })

  describe('syncWithChatwoot', () => {
    beforeEach(() => {
      // Mock environment variables
      process.env.CHATWOOT_URL = 'http://chatwoot.test'
      process.env.CHATWOOT_API_TOKEN = 'system-token'
    })

    it('should sync inboxes from Chatwoot successfully', async () => {
      const accountId = 1
      const createdBy = 'user123'
      const apiKey = 'test-key'

      const chatwootInboxes = [
        { id: 1, name: 'Inbox 1', channel_type: 'web_widget' },
        { id: 2, name: 'Inbox 2', channel_type: 'email' }
      ]

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ payload: chatwootInboxes })
      })

      // Mock Inbox.findOne to return null for both (new inboxes)
      vi.mocked(Inbox.findOne).mockResolvedValue(null)

      // Mock createInbox method
      const mockCreateInbox = vi.spyOn(inboxService, 'createInbox')
        .mockImplementation(async (data) => ({ _id: `inbox-${data.inboxId}`, ...data }) as any)

      const result = await inboxService.syncWithChatwoot(accountId, createdBy, apiKey)

      expect(fetch).toHaveBeenCalledWith(
        'http://chatwoot.test/api/v1/accounts/1/inboxes',
        expect.objectContaining({
          headers: expect.objectContaining({
            'api_access_token': apiKey
          })
        })
      )

      expect(mockCreateInbox).toHaveBeenCalledTimes(2)
      expect(result.results.created).toHaveLength(2)
      expect(result.results.updated).toHaveLength(0)
      expect(result.results.errors).toHaveLength(0)
    })

    it('should handle Chatwoot API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Invalid API key')
      })

      await expect(
        inboxService.syncWithChatwoot(1, 'user123', 'invalid-key')
      ).rejects.toThrow('Chatwoot API error: 401 Unauthorized - Invalid API key')
    })

    it('should use system API token when no key provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ payload: [] })
      })

      await inboxService.syncWithChatwoot(1, 'user123')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'api_access_token': 'system-token'
          })
        })
      )
    })
  })

  describe('updateAgentConfig', () => {
    it('should update agent configuration successfully', async () => {
      const inboxId = 'inbox123'
      const agentId = 'agent123'
      const updates = {
        priority: 150,
        isActive: false,
        config: { newSetting: 'value' }
      }

      const mockAgent = {
        agentId: { toString: () => agentId },
        priority: 100,
        isActive: true,
        config: { oldSetting: 'old' }
      }

      const mockInbox = {
        _id: inboxId,
        agents: [mockAgent],
        save: vi.fn().mockResolvedValue(undefined),
        populate: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      const result = await inboxService.updateAgentConfig(inboxId, agentId, updates)

      expect(mockAgent.priority).toBe(150)
      expect(mockAgent.isActive).toBe(false)
      expect(mockAgent.config).toEqual({ oldSetting: 'old', newSetting: 'value' })
      expect(mockInbox.save).toHaveBeenCalled()
      expect(result).toBe(mockInbox)
    })

    it('should throw error if agent not found in inbox', async () => {
      const mockInbox = {
        _id: 'inbox123',
        agents: []
      }

      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      await expect(
        inboxService.updateAgentConfig('inbox123', 'agent123', {})
      ).rejects.toThrow('Agent is not assigned to this inbox')
    })

    it('should re-sort agents when priority is updated', async () => {
      const mockAgent1 = { agentId: { toString: () => 'agent1' }, priority: 100 }
      const mockAgent2 = { agentId: { toString: () => 'agent2' }, priority: 200 }
      
      const mockInbox = {
        _id: 'inbox123',
        agents: [mockAgent1, mockAgent2],
        save: vi.fn().mockResolvedValue(undefined),
        populate: vi.fn().mockResolvedValue(undefined)
      }

      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      // Update agent2 to have lower priority
      await inboxService.updateAgentConfig('inbox123', 'agent2', { priority: 50 })

      expect(mockAgent2.priority).toBe(50)
      // Verify agents were sorted (agent2 should now be first)
      expect(mockInbox.agents[0]).toBe(mockAgent2)
      expect(mockInbox.agents[1]).toBe(mockAgent1)
    })
  })

  describe('routeToAgents', () => {
    it('should return correct processing order', async () => {
      const inboxId = 'inbox123'
      const message = { content: 'Test message' }

      const mockInbox = {
        _id: inboxId,
        name: 'Test Inbox',
        isActive: true,
        responseAgent: { agentId: 'response-agent' },
        agents: [
          { agentId: 'agent1', priority: 50, isActive: true },   // pre-process
          { agentId: 'agent2', priority: 150, isActive: true },  // main-process
          { agentId: 'agent3', priority: 250, isActive: true },  // post-process
          { agentId: 'agent4', priority: 100, isActive: false }  // inactive
        ],
        populate: vi.fn().mockReturnThis()
      }

      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      const result = await inboxService.routeToAgents(inboxId, message)

      expect(result.processing.responseAgent).toBe('response-agent')
      expect(result.processing.preProcessAgents).toHaveLength(1)
      expect(result.processing.mainProcessAgents).toHaveLength(1)
      expect(result.processing.postProcessAgents).toHaveLength(1)
      
      // Verify inactive agent is not included
      const allAgents = [
        ...result.processing.preProcessAgents,
        ...result.processing.mainProcessAgents,
        ...result.processing.postProcessAgents
      ]
      expect(allAgents.find(a => a.agentId === 'agent4')).toBeUndefined()
    })

    it('should throw error for inactive inbox', async () => {
      const mockInbox = {
        _id: 'inbox123',
        isActive: false,
        populate: vi.fn().mockReturnThis()
      }

      vi.mocked(Inbox.findById).mockResolvedValue(mockInbox as any)

      await expect(
        inboxService.routeToAgents('inbox123', {})
      ).rejects.toThrow('Inbox not found or inactive')
    })
  })
})