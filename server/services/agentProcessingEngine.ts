import Agent from '~/server/models/Agent'
import Inbox from '~/server/models/Inbox'
import aiService from './aiService'
import chatwootService from './chatwootService'

interface ProcessingResult {
  success: boolean
  agentId: string
  agentName: string
  agentType: string
  response?: string
  error?: string
  processedAt: string
  duration?: number
  messageSent?: boolean
  sendError?: string
}

interface ProcessingContext {
  message: string
  conversation_id?: number
  account_id?: number
  sender?: any
  conversation_history?: any[]
  agent_config?: any
  event_type?: string
  timestamp?: string
  inbox?: any
}

class AgentProcessingEngine {

  // ==================== CORE PROCESSING METHODS ====================

  /**
   * Process a single agent with a message
   * @param agent - Agent document
   * @param context - Processing context
   * @param config - Agent-specific configuration overrides
   * @returns Promise<ProcessingResult>
   */
  async processAgent(agent: any, context: ProcessingContext, config: any = {}): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Processing with agent: ${agent.name} (${agent.agentType})`)
      
      // Get conversation history if needed and not already provided
      let conversationHistory = context.conversation_history || []
      if (!conversationHistory.length && context.conversation_id && context.account_id) {
        try {
          conversationHistory = await chatwootService.getConversationMessages(
            context.account_id,
            context.conversation_id,
            config.chatwootApiKey || agent.settings?.chatwootApiKey
          )
        } catch (historyError) {
          console.warn(`Failed to get conversation history for agent ${agent.name}:`, historyError)
        }
      }

      // Prepare AI service context
      const aiContext = {
        message: context.message,
        conversation_id: context.conversation_id,
        account_id: context.account_id,
        sender: context.sender,
        conversation_history: conversationHistory,
        agent_config: config,
        event_type: context.event_type || 'message_created',
        timestamp: context.timestamp || new Date().toISOString(),
        inbox: context.inbox
      }

      // Merge settings: agent defaults + inbox-specific overrides
      const processingSettings = {
        ...agent.settings,
        ...config,
        contextDocuments: agent.contextDocuments
      }

      // Apply response delay if configured
      if (processingSettings.responseDelay && processingSettings.responseDelay > 0) {
        console.log(`Applying response delay of ${processingSettings.responseDelay}s for agent ${agent.name}`)
        await new Promise(resolve => setTimeout(resolve, processingSettings.responseDelay * 1000))
      }

      // Process with AI service
      const response = await aiService.processMessage(
        agent.prompt,
        aiContext,
        processingSettings
      )

      const duration = Date.now() - startTime
      
      return {
        success: true,
        agentId: agent._id.toString(),
        agentName: agent.name,
        agentType: agent.agentType,
        response: response,
        processedAt: new Date().toISOString(),
        duration
      }
      
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`Error processing with agent ${agent.name}:`, error)
      
      return {
        success: false,
        agentId: agent._id.toString(),
        agentName: agent.name,
        agentType: agent.agentType,
        error: error.message,
        processedAt: new Date().toISOString(),
        duration
      }
    }
  }

  // ==================== PIPELINE EXECUTION METHODS ====================

  /**
   * Execute pre-processing agents sequentially (priority < 100)
   * @param inbox - Inbox document
   * @param context - Processing context
   * @returns Promise<ProcessingResult[]>
   */
  async executePreProcessAgents(inbox: any, context: ProcessingContext): Promise<ProcessingResult[]> {
    const preProcessAgents = inbox.agents
      .filter((a: any) => a.isActive && a.agentId && a.priority < 100)
      .sort((a: any, b: any) => a.priority - b.priority)

    console.log(`Processing ${preProcessAgents.length} pre-process agents sequentially`)
    
    const results: ProcessingResult[] = []
    
    for (const agentAssignment of preProcessAgents) {
      const result = await this.processAgent(
        agentAssignment.agentId,
        context,
        agentAssignment.config
      )
      results.push(result)
      
      // Optional: If pre-processing fails, you might want to stop the pipeline
      // This depends on your business logic requirements
      if (!result.success) {
        console.warn(`Pre-process agent ${result.agentName} failed, continuing pipeline...`)
      }
    }
    
    return results
  }

  /**
   * Execute main processing agents in parallel (priority 100-199)
   * @param inbox - Inbox document  
   * @param context - Processing context
   * @returns Promise<ProcessingResult[]>
   */
  async executeMainAgents(inbox: any, context: ProcessingContext): Promise<ProcessingResult[]> {
    const mainAgents = inbox.agents
      .filter((a: any) => a.isActive && a.agentId && a.priority >= 100 && a.priority < 200)
      .sort((a: any, b: any) => a.priority - b.priority)

    console.log(`Processing ${mainAgents.length} main agents in parallel`)
    
    if (mainAgents.length === 0) {
      return []
    }

    // Execute all main agents in parallel
    const mainPromises = mainAgents.map((agentAssignment: any) =>
      this.processAgent(agentAssignment.agentId, context, agentAssignment.config)
    )
    
    const mainResults = await Promise.allSettled(mainPromises)
    
    return mainResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        const agentName = mainAgents[index].agentId.name
        console.error(`Main agent ${agentName} failed:`, result.reason)
        return {
          success: false,
          agentId: mainAgents[index].agentId._id.toString(),
          agentName: agentName,
          agentType: mainAgents[index].agentId.agentType,
          error: result.reason.message || 'Unknown error',
          processedAt: new Date().toISOString()
        }
      }
    })
  }

  /**
   * Execute post-processing agents sequentially (priority >= 200)
   * @param inbox - Inbox document
   * @param context - Processing context
   * @returns Promise<ProcessingResult[]>
   */
  async executePostProcessAgents(inbox: any, context: ProcessingContext): Promise<ProcessingResult[]> {
    const postProcessAgents = inbox.agents
      .filter((a: any) => a.isActive && a.agentId && a.priority >= 200)
      .sort((a: any, b: any) => a.priority - b.priority)

    console.log(`Processing ${postProcessAgents.length} post-process agents sequentially`)
    
    const results: ProcessingResult[] = []
    
    for (const agentAssignment of postProcessAgents) {
      const result = await this.processAgent(
        agentAssignment.agentId,
        context,
        agentAssignment.config
      )
      results.push(result)
    }
    
    return results
  }

  /**
   * Execute response agent (special handling for response agents)
   * @param inbox - Inbox document
   * @param context - Processing context
   * @returns Promise<ProcessingResult | null>
   */
  async executeResponseAgent(inbox: any, context: ProcessingContext): Promise<ProcessingResult | null> {
    if (!inbox.responseAgent?.agentId) {
      console.log('No response agent configured for this inbox')
      return null
    }

    console.log(`Processing response agent: ${inbox.responseAgent.agentId.name}`)
    
    const responseResult = await this.processAgent(
      inbox.responseAgent.agentId,
      context,
      inbox.responseAgent.config
    )

    // Send response to Chatwoot if successful and we have conversation details
    if (responseResult.success && responseResult.response && context.conversation_id && context.account_id) {
      try {
        const apiKey = inbox.responseAgent.config?.chatwootApiKey || 
                      inbox.responseAgent.agentId.settings?.chatwootApiKey ||
                      inbox.chatwoot?.apiKey

        await chatwootService.sendMessage(
          context.account_id,
          context.conversation_id,
          responseResult.response,
          apiKey
        )
        
        responseResult.messageSent = true
        console.log(`Response sent to Chatwoot for conversation ${context.conversation_id}`)
        
      } catch (sendError: any) {
        console.error('Failed to send response to Chatwoot:', sendError)
        responseResult.sendError = sendError.message
        responseResult.messageSent = false
      }
    }

    return responseResult
  }

  // ==================== COMPLETE PIPELINE EXECUTION ====================

  /**
   * Execute complete processing pipeline for an inbox
   * @param inboxId - Inbox ID
   * @param context - Processing context
   * @returns Promise<CompletePipelineResult>
   */
  async executeCompletePipeline(inboxId: string, context: ProcessingContext) {
    try {
      // Load inbox with populated agents
      const inbox = await Inbox.findById(inboxId)
        .populate('responseAgent.agentId')
        .populate('agents.agentId')

      if (!inbox || !inbox.isActive) {
        throw new Error('Inbox not found or inactive')
      }

      console.log(`Executing complete pipeline for inbox ${inbox.name} (${inboxId})`)

      const pipelineStartTime = Date.now()
      const processingResults = {
        preProcess: [] as ProcessingResult[],
        response: null as ProcessingResult | null,
        mainProcess: [] as ProcessingResult[],
        postProcess: [] as ProcessingResult[],
        errors: [] as any[]
      }

      // Add inbox info to context
      const enrichedContext = {
        ...context,
        inbox: {
          id: inbox._id,
          name: inbox.name,
          channelType: inbox.channelType,
          accountId: inbox.accountId,
          inboxId: inbox.inboxId
        }
      }

      try {
        // 1. Pre-processing agents (priority < 100) - Sequential
        processingResults.preProcess = await this.executePreProcessAgents(inbox, enrichedContext)

        // 2. Response agent (if configured) - After pre-processing
        processingResults.response = await this.executeResponseAgent(inbox, enrichedContext)

        // 3. Main processing agents (priority 100-199) - Parallel  
        processingResults.mainProcess = await this.executeMainAgents(inbox, enrichedContext)

        // 4. Post-processing agents (priority >= 200) - Sequential
        processingResults.postProcess = await this.executePostProcessAgents(inbox, enrichedContext)

      } catch (pipelineError: any) {
        console.error('Pipeline execution error:', pipelineError)
        processingResults.errors.push({
          stage: 'pipeline',
          error: pipelineError.message,
          timestamp: new Date().toISOString()
        })
      }

      // Calculate summary
      const allResults = [
        ...processingResults.preProcess,
        ...(processingResults.response ? [processingResults.response] : []),
        ...processingResults.mainProcess,
        ...processingResults.postProcess
      ]

      const totalAgents = allResults.length
      const successfulAgents = allResults.filter(r => r.success).length
      const failedAgents = totalAgents - successfulAgents
      const totalDuration = Date.now() - pipelineStartTime

      return {
        success: true,
        inbox: {
          id: inbox._id,
          name: inbox.name,
          channelType: inbox.channelType
        },
        context: enrichedContext,
        processing: {
          totalAgents,
          successfulAgents,
          failedAgents,
          totalDuration,
          results: processingResults
        },
        summary: {
          preProcessAgents: processingResults.preProcess.length,
          responseAgent: processingResults.response ? 1 : 0,
          mainProcessAgents: processingResults.mainProcess.length,
          postProcessAgents: processingResults.postProcess.length,
          responseGenerated: !!processingResults.response?.response,
          messageSent: !!processingResults.response?.messageSent
        },
        processedAt: new Date().toISOString()
      }

    } catch (error: any) {
      console.error('Complete pipeline execution error:', error)
      throw error
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get processing order preview for an inbox (for debugging/testing)
   * @param inboxId - Inbox ID
   * @returns Promise<ProcessingOrderPreview>
   */
  async getProcessingOrder(inboxId: string) {
    try {
      const inbox = await Inbox.findById(inboxId)
        .populate('responseAgent.agentId', 'name agentType')
        .populate('agents.agentId', 'name agentType')

      if (!inbox) {
        throw new Error('Inbox not found')
      }

      const sortedAgents = inbox.agents
        .filter((a: any) => a.isActive && a.agentId)
        .sort((a: any, b: any) => a.priority - b.priority)

      return {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        processingOrder: {
          preProcess: sortedAgents
            .filter((a: any) => a.priority < 100)
            .map((a: any) => ({
              name: a.name,
              agentType: a.agentType,
              priority: a.priority,
              agentId: a.agentId._id
            })),
          responseAgent: inbox.responseAgent?.agentId ? {
            name: inbox.responseAgent.agentId.name,
            agentType: inbox.responseAgent.agentId.agentType,
            agentId: inbox.responseAgent.agentId._id
          } : null,
          mainProcess: sortedAgents
            .filter((a: any) => a.priority >= 100 && a.priority < 200)
            .map((a: any) => ({
              name: a.name,
              agentType: a.agentType,
              priority: a.priority,
              agentId: a.agentId._id
            })),
          postProcess: sortedAgents
            .filter((a: any) => a.priority >= 200)
            .map((a: any) => ({
              name: a.name,
              agentType: a.agentType,
              priority: a.priority,
              agentId: a.agentId._id
            }))
        }
      }
    } catch (error) {
      console.error('Error getting processing order:', error)
      throw error
    }
  }
}

export default new AgentProcessingEngine()