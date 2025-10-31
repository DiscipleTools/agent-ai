/**
 * Create a new agent
 * POST /api/agents
 */
import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { 
  sanitizeText, 
  sanitizeObject, 
  sanitizeContent,
  schemas,
  validators 
} from '~/utils/sanitize'


export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get user from checker
    const user = checker.user

    // Get and validate request body
    const body = await readBody(event)
    
    if (!body) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Request body is required'
      })
    }

    // Validate required fields
    const errors: string[] = []

    if (!validators.textLength(body.name, 2, 100)) {
      errors.push('Agent name must be between 2 and 100 characters')
    }


    if (body.description && !validators.textLength(body.description, 0, 500)) {
      errors.push('Description cannot exceed 500 characters')
    }

    if (!body.workflow?.triggers || !Array.isArray(body.workflow.triggers) || body.workflow.triggers.length === 0) {
      errors.push('At least one trigger is required')
    }

    if (!body.workflow?.actions || !Array.isArray(body.workflow.actions) || body.workflow.actions.length === 0) {
      errors.push('At least one action is required')
    }

    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: errors.join('; ')
      })
    }

    // Sanitize and structure agent data
    const agentData = {
      name: sanitizeText(body.name),
      description: sanitizeText(body.description || ''),
      createdBy: user.id,
      
      // AI settings
      settings: {
        temperature: body.settings?.temperature || 0.3,
        maxTokens: body.settings?.maxTokens || 500,
        responseDelay: body.settings?.responseDelay || 0,
        connectionId: body.settings?.connectionId || null,
        modelId: body.settings?.modelId || null
      },
      
      workflow: {
        triggers: body.workflow.triggers.map((trigger: any) => ({
          type: sanitizeText(trigger.type)
        })),

        conditions: (body.workflow.conditions || []).map((condition: any) => ({
          type: sanitizeText(condition.type),
          operator: sanitizeText(condition.operator || 'equals'),
          value: condition.value,
          logicalOperator: sanitizeText(condition.logicalOperator || 'AND'),
          examples: condition.examples || ''
        })),

        actions: body.workflow.actions.map((action: any, index: number) => ({
          type: sanitizeText(action.type),
          parameters: sanitizeObject(action.parameters || {}, {
            // Allow mixed content for parameters
            '*': 'mixed'
          }),
          order: action.order || (index + 1),
          continueOnFailure: action.continueOnFailure !== false,
          delay: Math.max(0, action.delay || 0)
        })),

        isActive: body.workflow.isActive !== false
      },
      
      // Initialize analytics
      analytics: {
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        avgExecutionTime: 0
      },
      
      isActive: body.isActive !== false
    }

    // Validate trigger and action types
    const validTriggerTypes = [
      'conversation_created', 'conversation_status_changed',
      'conversation_assigned', 'message_created',
    ]

    const validActionTypes = [
      'ai_response', 'ai_summarize', 'ai_categorize', 'ai_sentiment_analysis',
      'change_status', 'assign_agent', 'add_private_note', 'add_public_note',
      'set_priority', 'set_custom_attribute', 'update_contact_attribute',
      'mark_contact_hostile',
      'wait', 'stop_workflow'
    ]

    // Validate all trigger types
    for (const trigger of agentData.workflow.triggers) {
      if (!validTriggerTypes.includes(trigger.type)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid trigger type: ${trigger.type}`
        })
      }
    }

    // Validate all action types
    for (const action of agentData.workflow.actions) {
      if (!validActionTypes.includes(action.type)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid action type: ${action.type}`
        })
      }
    }

    // Validate condition types
    const validConditionTypes = [
      'conversation_status',
      'message_contains',
      'message_is_toxic'
    ]

    for (const condition of agentData.workflow.conditions) {
      if (!validConditionTypes.includes(condition.type)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid condition type: ${condition.type}`
        })
      }
    }

    // Create the agent
    const agent = new Agent(agentData)
    await agent.save()

    return {
      success: true,
      message: 'Agent created successfully',
      data: {
        _id: agent._id,
        name: agent.name,
        description: agent.description,
        settings: agent.settings,
        workflow: agent.workflow,
        analytics: agent.analytics,
        isActive: agent.isActive,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt
      }
    }

  } catch (error: any) {
    console.error('Create agent error:', error)
    
    if (error.statusCode) {
      throw error
    }

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message)
      throw createError({
        statusCode: 400,
        statusMessage: messages.join('; ')
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create agent'
    })
  }
}) 