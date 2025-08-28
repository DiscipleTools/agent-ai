import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import agentProcessingEngine from '../../server/services/agentProcessingEngine'
import Inbox from '../../server/models/Inbox'
import aiService from '../../server/services/aiService'
import chatwootService from '../../server/services/chatwootService'

// Mock dependencies
vi.mock('../../server/models/Inbox')
vi.mock('../../server/services/aiService')
vi.mock('../../server/services/chatwootService')

describe('AgentProcessingEngine Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('processAgent', () => {
    it('should process agent successfully', async () => {
      const mockAgent = {
        _id: 'agent123',
        name: 'Test Agent',
        agentType: 'analytics',
        prompt: 'Analyze this message',
        settings: {
          temperature: 0.7,
          maxTokens: 1000
        },
        contextDocuments: []
      }

      const mockContext = {
        message: 'Hello world',
        conversation_id: 123,
        account_id: 1,
        sender: { id: 1, name: 'User' }
      }

      const mockConfig = {
        customSetting: 'value'
      }

      const mockResponse = 'AI generated response'

      // Mock chatwoot service
      vi.mocked(chatwootService.getConversationMessages).mockResolvedValue([])
      
      // Mock AI service
      vi.mocked(aiService.processMessage).mockResolvedValue(mockResponse)

      const result = await agentProcessingEngine.processAgent(mockAgent, mockContext, mockConfig)

      expect(result.success).toBe(true)
      expect(result.agentId).toBe('agent123')
      expect(result.agentName).toBe('Test Agent')
      expect(result.agentType).toBe('analytics')
      expect(result.response).toBe(mockResponse)
      expect(result.duration).toBeGreaterThan(0)

      expect(aiService.processMessage).toHaveBeenCalledWith(
        mockAgent.prompt,
        expect.objectContaining({
          message: mockContext.message,
          conversation_id: mockContext.conversation_id,
          agent_config: mockConfig
        }),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 1000,
          customSetting: 'value',
          contextDocuments: []
        })
      )
    })

    it('should handle agent processing errors gracefully', async () => {
      const mockAgent = {
        _id: 'agent123',
        name: 'Failing Agent',
        agentType: 'analytics',
        prompt: 'Test prompt',
        settings: {}
      }

      const mockContext = {
        message: 'Hello world'
      }

      const errorMessage = 'AI service failed'
      vi.mocked(aiService.processMessage).mockRejectedValue(new Error(errorMessage))

      const result = await agentProcessingEngine.processAgent(mockAgent, mockContext, {})

      expect(result.success).toBe(false)
      expect(result.agentId).toBe('agent123')
      expect(result.agentName).toBe('Failing Agent')
      expect(result.error).toBe(errorMessage)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should apply response delay when configured', async () => {
      const mockAgent = {
        _id: 'agent123',
        name: 'Delayed Agent',
        agentType: 'response',
        prompt: 'Test prompt',
        settings: {},
        contextDocuments: []
      }

      const mockContext = { message: 'Hello' }
      const mockConfig = { responseDelay: 2 }

      vi.mocked(aiService.processMessage).mockResolvedValue('Response')

      const startTime = Date.now()
      
      // Start the processing (but don't await yet)
      const resultPromise = agentProcessingEngine.processAgent(mockAgent, mockContext, mockConfig)
      
      // Fast-forward time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000)
      
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThanOrEqual(2000)
    })

    it('should fetch conversation history when needed', async () => {
      const mockAgent = {
        _id: 'agent123',
        name: 'Test Agent',
        agentType: 'response',
        prompt: 'Test prompt',
        settings: { chatwootApiKey: 'agent-key' },
        contextDocuments: []
      }

      const mockContext = {
        message: 'Hello',
        conversation_id: 123,
        account_id: 1
      }

      const mockHistory = [
        { id: 1, content: 'Previous message' }
      ]

      vi.mocked(chatwootService.getConversationMessages).mockResolvedValue(mockHistory)
      vi.mocked(aiService.processMessage).mockResolvedValue('Response')

      await agentProcessingEngine.processAgent(mockAgent, mockContext, {})

      expect(chatwootService.getConversationMessages).toHaveBeenCalledWith(
        1, 123, 'agent-key'
      )

      expect(aiService.processMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          conversation_history: mockHistory
        }),
        expect.any(Object)
      )
    })
  })

  describe('executePreProcessAgents', () => {
    it('should execute pre-process agents sequentially in priority order', async () => {
      const mockInbox = {
        agents: [
          {
            isActive: true,
            priority: 30,
            agentId: { _id: 'agent2', name: 'Agent 2' },
            config: {}
          },
          {
            isActive: true,
            priority: 10,
            agentId: { _id: 'agent1', name: 'Agent 1' },
            config: {}
          },
          {
            isActive: true,
            priority: 100, // Should not be included (>= 100)
            agentId: { _id: 'agent3', name: 'Agent 3' },
            config: {}
          }
        ]
      }

      const mockContext = { message: 'Hello' }

      // Track call order
      const callOrder: string[] = []
      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockImplementation(async (agent: any) => {
          callOrder.push(agent._id)
          return {
            success: true,
            agentId: agent._id,
            agentName: agent.name,
            agentType: 'pre-process',
            processedAt: new Date().toISOString()
          }
        })

      const results = await agentProcessingEngine.executePreProcessAgents(mockInbox, mockContext)

      expect(results).toHaveLength(2)
      expect(callOrder).toEqual(['agent1', 'agent2']) // Should be in priority order
      expect(mockProcessAgent).toHaveBeenCalledTimes(2)
    })

    it('should skip inactive agents', async () => {
      const mockInbox = {
        agents: [
          {
            isActive: false,
            priority: 10,
            agentId: { _id: 'inactive-agent' },
            config: {}
          },
          {
            isActive: true,
            priority: 20,
            agentId: { _id: 'active-agent', name: 'Active' },
            config: {}
          }
        ]
      }

      const mockContext = { message: 'Hello' }

      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockImplementation(async (agent: any) => ({
          success: true,
          agentId: agent._id,
          agentName: agent.name,
          agentType: 'pre-process',
          processedAt: new Date().toISOString()
        }))

      const results = await agentProcessingEngine.executePreProcessAgents(mockInbox, mockContext)

      expect(results).toHaveLength(1)
      expect(mockProcessAgent).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'active-agent' }),
        mockContext,
        {}
      )
    })
  })

  describe('executeMainAgents', () => {
    it('should execute main agents in parallel', async () => {
      const mockInbox = {
        agents: [
          {
            isActive: true,
            priority: 150,
            agentId: { _id: 'agent1', name: 'Agent 1' },
            config: {}
          },
          {
            isActive: true,
            priority: 120,
            agentId: { _id: 'agent2', name: 'Agent 2' },
            config: {}
          },
          {
            isActive: true,
            priority: 50, // Should not be included (< 100)
            agentId: { _id: 'agent3', name: 'Agent 3' },
            config: {}
          },
          {
            isActive: true,
            priority: 250, // Should not be included (>= 200)
            agentId: { _id: 'agent4', name: 'Agent 4' },
            config: {}
          }
        ]
      }

      const mockContext = { message: 'Hello' }

      // Track concurrent execution
      const executionTimes: Record<string, number> = {}
      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockImplementation(async (agent: any) => {
          const startTime = Date.now()
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 100))
          executionTimes[agent._id] = Date.now() - startTime
          
          return {
            success: true,
            agentId: agent._id,
            agentName: agent.name,
            agentType: 'main',
            processedAt: new Date().toISOString()
          }
        })

      const results = await agentProcessingEngine.executeMainAgents(mockInbox, mockContext)

      expect(results).toHaveLength(2) // Only agents with priority 100-199
      expect(mockProcessAgent).toHaveBeenCalledTimes(2)
      
      // Both agents should have been called with correct priorities
      const agentIds = results.map(r => r.agentId)
      expect(agentIds).toContain('agent1')
      expect(agentIds).toContain('agent2')
    })

    it('should handle parallel execution failures gracefully', async () => {
      const mockInbox = {
        agents: [
          {
            isActive: true,
            priority: 100,
            agentId: { _id: 'success-agent', name: 'Success Agent' },
            config: {}
          },
          {
            isActive: true,
            priority: 110,
            agentId: { _id: 'fail-agent', name: 'Fail Agent' },
            config: {}
          }
        ]
      }

      const mockContext = { message: 'Hello' }

      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockImplementation(async (agent: any) => {
          if (agent._id === 'fail-agent') {
            throw new Error('Processing failed')
          }
          return {
            success: true,
            agentId: agent._id,
            agentName: agent.name,
            agentType: 'main',
            processedAt: new Date().toISOString()
          }
        })

      const results = await agentProcessingEngine.executeMainAgents(mockInbox, mockContext)

      expect(results).toHaveLength(2)
      
      // Success agent should succeed
      const successResult = results.find(r => r.agentId === 'success-agent')
      expect(successResult?.success).toBe(true)
      
      // Fail agent should have error recorded
      const failResult = results.find(r => r.agentId === 'fail-agent')
      expect(failResult?.success).toBe(false)
      expect(failResult?.error).toContain('Processing failed')
    })
  })

  describe('executeResponseAgent', () => {
    it('should execute response agent and send message to Chatwoot', async () => {
      const mockInbox = {
        responseAgent: {
          agentId: {
            _id: 'response-agent',
            name: 'Response Agent',
            settings: { chatwootApiKey: 'agent-key' }
          },
          config: { temperature: 0.8 }
        },
        chatwoot: { apiKey: 'inbox-key' }
      }

      const mockContext = {
        message: 'Hello',
        conversation_id: 123,
        account_id: 1
      }

      const mockResponse = 'AI response to customer'

      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockResolvedValue({
          success: true,
          agentId: 'response-agent',
          agentName: 'Response Agent',
          agentType: 'response',
          response: mockResponse,
          processedAt: new Date().toISOString()
        })

      vi.mocked(chatwootService.sendMessage).mockResolvedValue({ id: 456 })

      const result = await agentProcessingEngine.executeResponseAgent(mockInbox, mockContext)

      expect(result?.success).toBe(true)
      expect(result?.response).toBe(mockResponse)
      expect(result?.messageSent).toBe(true)

      expect(mockProcessAgent).toHaveBeenCalledWith(
        mockInbox.responseAgent.agentId,
        mockContext,
        mockInbox.responseAgent.config
      )

      expect(chatwootService.sendMessage).toHaveBeenCalledWith(
        1, 123, mockResponse, 'agent-key'
      )
    })

    it('should return null when no response agent configured', async () => {
      const mockInbox = {
        responseAgent: null
      }

      const mockContext = { message: 'Hello' }

      const result = await agentProcessingEngine.executeResponseAgent(mockInbox, mockContext)

      expect(result).toBeNull()
    })

    it('should handle Chatwoot send failure gracefully', async () => {
      const mockInbox = {
        responseAgent: {
          agentId: {
            _id: 'response-agent',
            name: 'Response Agent'
          },
          config: {}
        }
      }

      const mockContext = {
        message: 'Hello',
        conversation_id: 123,
        account_id: 1
      }

      const mockProcessAgent = vi.spyOn(agentProcessingEngine, 'processAgent')
        .mockResolvedValue({
          success: true,
          agentId: 'response-agent',
          agentName: 'Response Agent',
          agentType: 'response',
          response: 'AI response',
          processedAt: new Date().toISOString()
        })

      vi.mocked(chatwootService.sendMessage).mockRejectedValue(new Error('Send failed'))

      const result = await agentProcessingEngine.executeResponseAgent(mockInbox, mockContext)

      expect(result?.success).toBe(true)
      expect(result?.messageSent).toBe(false)
      expect(result?.sendError).toBe('Send failed')
    })
  })

  describe('executeCompletePipeline', () => {
    it('should execute complete pipeline in correct order', async () => {
      const inboxId = 'inbox123'
      const mockContext = {
        message: 'Hello world',
        conversation_id: 123,
        account_id: 1
      }

      const mockInbox = {
        _id: inboxId,
        name: 'Test Inbox',
        channelType: 'web_widget',
        accountId: 1,
        inboxId: 123,
        isActive: true,
        responseAgent: {
          agentId: { _id: 'response-agent', name: 'Response Agent' },
          config: {}
        },
        agents: [
          { isActive: true, priority: 50, agentId: { _id: 'pre-agent' }, config: {} },
          { isActive: true, priority: 150, agentId: { _id: 'main-agent' }, config: {} },
          { isActive: true, priority: 250, agentId: { _id: 'post-agent' }, config: {} }
        ]
      }

      // Mock Inbox.findById
      const mockPopulate = vi.fn().mockResolvedValue(mockInbox)
      vi.mocked(Inbox.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: mockPopulate
        })
      } as any)

      // Track execution order
      const executionOrder: string[] = []
      
      // Mock individual execution methods
      vi.spyOn(agentProcessingEngine, 'executePreProcessAgents')
        .mockImplementation(async () => {
          executionOrder.push('pre')
          return [{ success: true, agentId: 'pre-agent', agentName: 'Pre Agent', agentType: 'pre-process', processedAt: '' }]
        })

      vi.spyOn(agentProcessingEngine, 'executeResponseAgent')
        .mockImplementation(async () => {
          executionOrder.push('response')
          return { success: true, agentId: 'response-agent', agentName: 'Response Agent', agentType: 'response', processedAt: '', response: 'Response', messageSent: true }
        })

      vi.spyOn(agentProcessingEngine, 'executeMainAgents')
        .mockImplementation(async () => {
          executionOrder.push('main')
          return [{ success: true, agentId: 'main-agent', agentName: 'Main Agent', agentType: 'analytics', processedAt: '' }]
        })

      vi.spyOn(agentProcessingEngine, 'executePostProcessAgents')
        .mockImplementation(async () => {
          executionOrder.push('post')
          return [{ success: true, agentId: 'post-agent', agentName: 'Post Agent', agentType: 'post-process', processedAt: '' }]
        })

      const result = await agentProcessingEngine.executeCompletePipeline(inboxId, mockContext)

      expect(result.success).toBe(true)
      expect(executionOrder).toEqual(['pre', 'response', 'main', 'post'])
      expect(result.processing.totalAgents).toBe(4) // 1 response + 3 pipeline agents
      expect(result.processing.successfulAgents).toBe(4)
      expect(result.summary.responseGenerated).toBe(true)
      expect(result.summary.messageSent).toBe(true)
    })

    it('should throw error for inactive inbox', async () => {
      const mockInbox = {
        isActive: false
      }

      const mockPopulate = vi.fn().mockResolvedValue(mockInbox)
      vi.mocked(Inbox.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: mockPopulate
        })
      } as any)

      await expect(
        agentProcessingEngine.executeCompletePipeline('inbox123', { message: 'Hello' })
      ).rejects.toThrow('Inbox not found or inactive')
    })
  })

  describe('getProcessingOrder', () => {
    it('should return correct processing order preview', async () => {
      const inboxId = 'inbox123'
      const mockInbox = {
        _id: inboxId,
        name: 'Test Inbox',
        responseAgent: {
          agentId: {
            _id: 'response-agent',
            name: 'Response Agent',
            agentType: 'response'
          }
        },
        agents: [
          {
            isActive: true,
            priority: 50,
            agentId: { _id: 'pre-agent', name: 'Pre Agent', agentType: 'pre-process' },
            name: 'Pre Agent',
            agentType: 'pre-process'
          },
          {
            isActive: true,
            priority: 150,
            agentId: { _id: 'main-agent', name: 'Main Agent', agentType: 'analytics' },
            name: 'Main Agent',
            agentType: 'analytics'
          },
          {
            isActive: true,
            priority: 250,
            agentId: { _id: 'post-agent', name: 'Post Agent', agentType: 'post-process' },
            name: 'Post Agent',
            agentType: 'post-process'
          },
          {
            isActive: false, // Should be excluded
            priority: 100,
            agentId: { _id: 'inactive-agent', name: 'Inactive Agent', agentType: 'analytics' },
            name: 'Inactive Agent',
            agentType: 'analytics'
          }
        ]
      }

      const mockPopulate = vi.fn().mockResolvedValue(mockInbox)
      vi.mocked(Inbox.findById).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: mockPopulate
        })
      } as any)

      const result = await agentProcessingEngine.getProcessingOrder(inboxId)

      expect(result.inbox.name).toBe('Test Inbox')
      expect(result.processingOrder.responseAgent?.name).toBe('Response Agent')
      expect(result.processingOrder.preProcess).toHaveLength(1)
      expect(result.processingOrder.mainProcess).toHaveLength(1)
      expect(result.processingOrder.postProcess).toHaveLength(1)

      // Verify inactive agent is not included
      const allAgents = [
        ...result.processingOrder.preProcess,
        ...result.processingOrder.mainProcess,
        ...result.processingOrder.postProcess
      ]
      expect(allAgents.find(a => a.agentId === 'inactive-agent')).toBeUndefined()
    })
  })
})