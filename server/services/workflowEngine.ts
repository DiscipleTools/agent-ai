/**
 * Workflow Engine Service
 * 
 * This service is responsible for processing workflow agents based on triggers and conditions.
 * It replaces the old agent processing engine for workflow-type agents and provides
 * a flexible system for automating conversations based on events.
 */
import Agent from '~/server/models/Agent'
import Inbox from '~/server/models/Inbox'
import chatwootService from './chatwootService'
import aiService from './aiService'

interface WorkflowEvent {
  type: string
  data: {
    message?: string
    message_id?: string | number
    message_type?: string | number
    conversation_id?: number
    account_id?: number
    sender?: any
    conversation?: any
    account?: any
    inbox?: any
    contact?: any
    assignee?: any
    timestamp?: string
  }
  metadata?: {
    inboxId?: string
    source?: string
  }
}

interface WorkflowContext {
  event: WorkflowEvent
  conversation?: any
  contact?: any
  agent?: any
  inbox?: any
  executionId: string
}

interface ActionResult {
  success: boolean
  action: string
  actionType: string
  result?: any
  error?: string
  executionTime: number
}

interface WorkflowExecutionResult {
  workflowId: string
  agentName: string
  success: boolean
  actionsExecuted: ActionResult[]
  totalExecutionTime: number
  error?: string
  executedAt: string
}

class WorkflowEngine {
  /**
   * Main entry point for processing workflow events
   */
  async processEvent(event: WorkflowEvent, inboxId?: string): Promise<WorkflowExecutionResult[]> {
    try {
      console.log(`Processing workflow event: ${event.type}`)
      
      // Find matching workflow agents
      const matchingAgents = await this.findMatchingAgents(event, inboxId)
      
      if (matchingAgents.length === 0) {
        console.log(`No matching workflow agents found for event: ${event.type}`)
        return []
      }
      
      console.log(`Found ${matchingAgents.length} matching workflow agents`)
      
      // Execute workflows in parallel (we can change this to sequential if needed)
      const results = await Promise.allSettled(
        matchingAgents.map(agent => this.executeWorkflow(agent, event, inboxId))
      )
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          const agent = matchingAgents[index]
          return {
            workflowId: agent._id.toString(),
            agentName: agent.name,
            success: false,
            actionsExecuted: [],
            totalExecutionTime: 0,
            error: result.reason?.message || 'Unknown workflow execution error',
            executedAt: new Date().toISOString()
          }
        }
      })
      
    } catch (error: any) {
      console.error('Workflow engine processing error:', error)
      throw error
    }
  }

  /**
   * Find agents that match the event trigger and conditions
   */
  private async findMatchingAgents(event: WorkflowEvent, inboxId?: string): Promise<any[]> {
    try {
      // Find workflow agents with matching triggers
      let agents = await Agent.findByTriggerType(event.type)
      
      // If inbox ID provided, filter by agents assigned to this inbox
      if (inboxId) {
        const assignedAgentIds = await this.getAgentsAssignedToInbox(inboxId)
        agents = agents.filter(agent => 
          assignedAgentIds.some(assignedId => assignedId.toString() === agent._id.toString())
        )
      }
      
      // Filter agents by conditions
      const matchingAgents = []
      for (const agent of agents) {
        if (await this.evaluateWorkflowConditions(agent, event)) {
          matchingAgents.push(agent)
        }
      }
      
      return matchingAgents.sort((a, b) => (a.priority || 100) - (b.priority || 100))
      
    } catch (error) {
      console.error('Error finding matching agents:', error)
      return []
    }
  }

  /**
   * Get agents assigned to a specific inbox
   */
  private async getAgentsAssignedToInbox(inboxId: string): Promise<string[]> {
    try {
      const inbox = await Inbox.findById(inboxId)
        .populate('agents.agentId')
      
      if (!inbox) {
        return []
      }
      
      const agentIds: string[] = []
      
      // Add other assigned agents
      inbox.agents?.forEach(assignment => {
        if (assignment.agentId && assignment.isActive) {
          agentIds.push(assignment.agentId._id.toString())
        }
      })
      
      return agentIds
      
    } catch (error) {
      console.error('Error getting agents assigned to inbox:', error)
      return []
    }
  }

  /**
   * Evaluate workflow conditions for an agent
   */
  private async evaluateWorkflowConditions(agent: any, event: WorkflowEvent): Promise<boolean> {
    try {
      const trigger = agent.workflow?.triggers?.find((t: any) => t.type === event.type && t.isActive)
      
      if (!trigger || !trigger.conditions || trigger.conditions.length === 0) {
        return true // No conditions = always match
      }
      
      // Evaluate all conditions
      let result = true
      let currentLogical = 'AND' // Start with AND
      
      for (const condition of trigger.conditions) {
        const conditionResult = await this.evaluateCondition(condition, event)
        
        if (currentLogical === 'AND') {
          result = result && conditionResult
        } else { // OR
          result = result || conditionResult
        }
        
        // Set next logical operator
        currentLogical = condition.logicalOperator || 'AND'
      }
      
      return result
      
    } catch (error) {
      console.error('Error evaluating workflow conditions:', error)
      return false
    }
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(condition: any, event: WorkflowEvent): Promise<boolean> {
    try {
      const { type, operator, value } = condition
      const eventData = event.data
      
      switch (type) {
        // Message content conditions
        case 'message_contains':
          return this.evaluateStringCondition(eventData.message || '', operator, value)
        
        case 'message_not_contains':
          return !this.evaluateStringCondition(eventData.message || '', 'contains', value)
        
        case 'message_length_greater':
          return this.evaluateNumberCondition((eventData.message || '').length, 'greater_than', value)
        
        case 'message_length_less':
          return this.evaluateNumberCondition((eventData.message || '').length, 'less_than', value)
        
        // Conversation conditions
        case 'conversation_status_equals':
          return this.evaluateStringCondition(eventData.conversation?.status || '', operator, value)
        
        case 'conversation_unassigned':
          return !eventData.conversation?.assignee_id
        
        case 'conversation_assignee_equals':
          return this.evaluateNumberCondition(eventData.conversation?.assignee_id || 0, operator, value)
        
        // Contact conditions
        case 'contact_is_new':
          // This would require checking if this is the contact's first conversation
          return eventData.conversation?.message_count === 1
        
        // Channel conditions  
        case 'channel_type_equals':
          return this.evaluateStringCondition(eventData.inbox?.channel_type || '', operator, value)
        
        case 'inbox_equals':
          return this.evaluateNumberCondition(eventData.inbox?.id || 0, operator, value)
        
        
        default:
          console.warn(`Unknown condition type: ${type}`)
          return true
      }
      
    } catch (error) {
      console.error(`Error evaluating condition ${condition.type}:`, error)
      return false
    }
  }

  /**
   * Helper method to evaluate string conditions
   */
  private evaluateStringCondition(actual: string, operator: string, expected: any): boolean {
    const actualLower = actual.toLowerCase()
    const expectedLower = typeof expected === 'string' ? expected.toLowerCase() : ''
    
    switch (operator) {
      case 'equals':
        return actualLower === expectedLower
      case 'not_equals':
        return actualLower !== expectedLower
      case 'contains':
        return actualLower.includes(expectedLower)
      case 'not_contains':
        return !actualLower.includes(expectedLower)
      case 'matches':
        try {
          return new RegExp(expected, 'i').test(actual)
        } catch {
          return false
        }
      default:
        return false
    }
  }

  /**
   * Helper method to evaluate number conditions
   */
  private evaluateNumberCondition(actual: number, operator: string, expected: any): boolean {
    const expectedNum = Number(expected)
    if (isNaN(expectedNum)) return false
    
    switch (operator) {
      case 'equals':
        return actual === expectedNum
      case 'not_equals':
        return actual !== expectedNum
      case 'greater_than':
        return actual > expectedNum
      case 'less_than':
        return actual < expectedNum
      default:
        return false
    }
  }


  /**
   * Execute a workflow for a specific agent
   */
  private async executeWorkflow(agent: any, event: WorkflowEvent, inboxId?: string): Promise<WorkflowExecutionResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Executing workflow: ${agent.name} (${agent._id})`)
      
      const context: WorkflowContext = {
        event,
        agent,
        executionId: `${agent._id}-${Date.now()}`
      }
      
      // Load additional context data if needed
      if (event.data.conversation_id && event.data.account_id) {
        try {
          context.conversation = await chatwootService.getConversation(
            event.data.account_id,
            event.data.conversation_id,
            agent.settings?.chatwootApiKey
          )
        } catch (error) {
          console.warn(`Failed to load conversation context: ${error}`)
        }
      }
      
      if (inboxId) {
        try {
          context.inbox = await Inbox.findById(inboxId)
        } catch (error) {
          console.warn(`Failed to load inbox context: ${error}`)
        }
      }
      
      // Execute actions in order
      const actionsExecuted: ActionResult[] = []
      const actions = agent.workflow?.actions?.filter((a: any) => a.type) || []
      
      // Sort actions by order
      actions.sort((a: any, b: any) => (a.order || 1) - (b.order || 1))
      
      for (const action of actions) {
        try {
          // Apply delay if specified
          if (action.delay && action.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, action.delay * 1000))
          }
          
          const actionResult = await this.executeAction(action, context)
          actionsExecuted.push(actionResult)
          
          // If action failed and continueOnFailure is false, stop execution
          if (!actionResult.success && !action.continueOnFailure) {
            console.warn(`Stopping workflow execution due to failed action: ${action.type}`)
            break
          }
          
        } catch (actionError: any) {
          const errorResult: ActionResult = {
            success: false,
            action: action.type,
            actionType: action.type,
            error: actionError.message,
            executionTime: 0
          }
          
          actionsExecuted.push(errorResult)
          
          if (!action.continueOnFailure) {
            break
          }
        }
      }
      
      const totalExecutionTime = Date.now() - startTime
      const success = actionsExecuted.length > 0 && actionsExecuted.every(a => a.success)
      
      // Update agent analytics
      try {
        await agent.updateAnalytics(totalExecutionTime, success)
      } catch (analyticsError) {
        console.warn('Failed to update agent analytics:', analyticsError)
      }
      
      return {
        workflowId: agent._id.toString(),
        agentName: agent.name,
        success,
        actionsExecuted,
        totalExecutionTime,
        executedAt: new Date().toISOString()
      }
      
    } catch (error: any) {
      const totalExecutionTime = Date.now() - startTime
      console.error(`Workflow execution failed for agent ${agent.name}:`, error)
      
      try {
        await agent.updateAnalytics(totalExecutionTime, false)
      } catch (analyticsError) {
        console.warn('Failed to update agent analytics after error:', analyticsError)
      }
      
      return {
        workflowId: agent._id.toString(),
        agentName: agent.name,
        success: false,
        actionsExecuted: [],
        totalExecutionTime,
        error: error.message,
        executedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: any, context: WorkflowContext): Promise<ActionResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Executing action: ${action.type}`)
      
      let result: any = null
      
      switch (action.type) {
        case 'ai_response':
          result = await this.executeAIResponse(action, context)
          break
          
        case 'change_status':
          result = await this.executeChangeStatus(action, context)
          break
          
        case 'assign_agent':
          result = await this.executeAssignAgent(action, context)
          break
          
        case 'add_private_note':
          result = await this.executeAddNote(action, context, true)
          break
          
        case 'add_public_note':
          result = await this.executeAddNote(action, context, false)
          break
          
        case 'set_priority':
          result = await this.executeSetPriority(action, context)
          break
          
        case 'set_custom_attribute':
          result = await this.executeSetCustomAttribute(action, context)
          break
          
          
        case 'wait':
          result = await this.executeWait(action, context)
          break
          
        default:
          throw new Error(`Unknown action type: ${action.type}`)
      }
      
      return {
        success: true,
        action: action.type,
        actionType: action.type,
        result,
        executionTime: Date.now() - startTime
      }
      
    } catch (error: any) {
      console.error(`Action execution failed for ${action.type}:`, error)
      
      return {
        success: false,
        action: action.type,
        actionType: action.type,
        error: error.message,
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Execute AI response action
   */
  private async executeAIResponse(action: any, context: WorkflowContext): Promise<any> {
    const { event, agent, conversation } = context
    
    if (!event.data.conversation_id || !event.data.account_id) {
      throw new Error('AI response requires conversation ID and account ID')
    }
    
    // Get conversation history
    let conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
    
    try {
      const messages = await chatwootService.getConversationMessages(
        event.data.account_id,
        event.data.conversation_id,
        agent.settings?.chatwootApiKey
      )
      
      if (messages && Array.isArray(messages)) {
        conversationHistory = messages
          .filter((msg: any) => msg.content && msg.content.trim())
          .slice(-10)
          .map((msg: any) => ({
            role: (msg.message_type === 0 || msg.message_type === 'incoming') ? 'user' : 'assistant',
            content: msg.content.trim()
          }))
      }
    } catch (error) {
      console.warn('Failed to get conversation history for AI response:', error)
    }
    
    // Generate AI response
    const prompt = action.parameters?.prompt || 'You are a helpful assistant.'
    const response = await aiService.generateResponse(
      agent._id,
      prompt,
      agent.contextDocuments || [],
      event.data.message || '',
      {
        temperature: action.parameters?.temperature || agent.settings?.temperature || 0.3,
        maxTokens: action.parameters?.maxTokens || agent.settings?.maxTokens || 500,
        connectionId: action.parameters?.connectionId || agent.settings?.connectionId,
        modelId: action.parameters?.modelId || agent.settings?.modelId
      },
      conversationHistory
    )
    
    // Send response to Chatwoot
    await chatwootService.sendMessage(
      event.data.account_id,
      event.data.conversation_id,
      response,
      action.parameters?.chatwootApiKey || agent.settings?.chatwootApiKey
    )
    
    return { response, sent: true }
  }

  /**
   * Execute change status action
   */
  private async executeChangeStatus(action: any, context: WorkflowContext): Promise<any> {
    const { event } = context
    
    if (!event.data.conversation_id || !event.data.account_id) {
      throw new Error('Change status requires conversation ID and account ID')
    }
    
    const status = action.parameters?.status || 'open'
    const validStatuses = ['open', 'resolved', 'pending', 'snoozed']
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`)
    }
    
    return await chatwootService.updateConversationStatus(
      event.data.account_id,
      event.data.conversation_id,
      status,
      action.parameters?.chatwootApiKey
    )
  }

  /**
   * Execute assign agent action
   */
  private async executeAssignAgent(action: any, context: WorkflowContext): Promise<any> {
    // This would require additional Chatwoot API methods for agent assignment
    // For now, we'll return a placeholder
    return { assigned: true, agentId: action.parameters?.agentId }
  }

  /**
   * Execute add note action
   */
  private async executeAddNote(action: any, context: WorkflowContext, isPrivate: boolean): Promise<any> {
    const { event } = context
    
    if (!event.data.conversation_id || !event.data.account_id) {
      throw new Error('Add note requires conversation ID and account ID')
    }
    
    const noteContent = action.parameters?.content || 'Automated note'
    
    // Send note as a message with appropriate type
    return await chatwootService.sendMessage(
      event.data.account_id,
      event.data.conversation_id,
      noteContent,
      action.parameters?.chatwootApiKey
    )
  }

  /**
   * Execute set priority action
   */
  private async executeSetPriority(action: any, context: WorkflowContext): Promise<any> {
    // This would require additional Chatwoot API methods for priority management
    // For now, we'll return a placeholder
    return { priority: action.parameters?.priority || 'medium' }
  }

  /**
   * Execute set custom attribute action
   */
  private async executeSetCustomAttribute(action: any, context: WorkflowContext): Promise<any> {
    // This would require additional Chatwoot API methods for custom attributes
    // For now, we'll return a placeholder
    return { 
      attribute: action.parameters?.attributeName,
      value: action.parameters?.attributeValue
    }
  }


  /**
   * Execute wait action
   */
  private async executeWait(action: any, context: WorkflowContext): Promise<any> {
    const duration = action.parameters?.duration || 1000 // milliseconds
    
    await new Promise(resolve => setTimeout(resolve, duration))
    
    return { waited: duration }
  }
}

export default new WorkflowEngine()