/**
 * Update an agent
 * PUT /api/agents/{id}
 */
import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware, canAccessAgentResource } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { 
  sanitizeText, 
  sanitizeObject,
  validators 
} from '~/utils/sanitize'

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get user from checker
    const user = checker.user

    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
      })
    }

    // Get and validate request body
    const body = await readBody(event)
    
    if (!body) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Request body is required'
      })
    }

    // Find existing agent
    const existingAgent = await Agent.findById(agentId)

    if (!existingAgent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Check if user can access this agent based on Chatwoot account administration
    if (!canAccessAgentResource(user, existingAgent)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    // Validate fields if provided
    const errors: string[] = []

    if (body.name !== undefined && !validators.textLength(body.name, 2, 100)) {
      errors.push('Agent name must be between 2 and 100 characters')
    }

    if (body.description !== undefined && !validators.textLength(body.description, 0, 500)) {
      errors.push('Description cannot exceed 500 characters')
    }


    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: errors.join('; ')
      })
    }

    // Prepare update data
    const updateData: any = {}

    if (body.name !== undefined) {
      updateData.name = sanitizeText(body.name)
    }

    if (body.description !== undefined) {
      updateData.description = sanitizeText(body.description)
    }


    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
    }

    if (body.settings !== undefined) {
      updateData.settings = {
        temperature: body.settings.temperature || existingAgent.settings?.temperature || 0.3,
        maxTokens: body.settings.maxTokens || existingAgent.settings?.maxTokens || 500,
        responseDelay: body.settings.responseDelay || existingAgent.settings?.responseDelay || 0,
        connectionId: body.settings.connectionId || existingAgent.settings?.connectionId || null,
        modelId: body.settings.modelId || existingAgent.settings?.modelId || null
      }
    }

    if (body.workflow !== undefined) {
      updateData.workflow = {
        triggers: body.workflow.triggers?.map((trigger: any) => ({
          type: sanitizeText(trigger.type),
          conditions: (trigger.conditions || []).map((condition: any) => ({
            type: sanitizeText(condition.type),
            operator: sanitizeText(condition.operator || 'equals'),
            value: condition.value,
            logicalOperator: sanitizeText(condition.logicalOperator || 'AND')
          })),
          isActive: trigger.isActive !== false
        })) || existingAgent.workflow?.triggers || [],
        
        actions: body.workflow.actions?.map((action: any, index: number) => ({
          type: sanitizeText(action.type),
          parameters: sanitizeObject(action.parameters || {}, {
            '*': 'mixed'
          }),
          order: action.order || (index + 1),
          continueOnFailure: action.continueOnFailure !== false,
          delay: Math.max(0, action.delay || 0)
        })) || existingAgent.workflow?.actions || [],
        
        isActive: body.workflow.isActive !== false
      }
    }

    // Update the agent
    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean()

    return {
      success: true,
      message: 'Agent updated successfully',
      data: {
        _id: updatedAgent._id,
        name: updatedAgent.name,
        description: updatedAgent.description,
        settings: updatedAgent.settings,
        workflow: updatedAgent.workflow,
        analytics: updatedAgent.analytics,
        isActive: updatedAgent.isActive,
        createdAt: updatedAgent.createdAt,
        updatedAt: updatedAgent.updatedAt
      }
    }

  } catch (error: any) {
    console.error('Update agent error:', error)
    
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
      statusMessage: 'Failed to update agent'
    })
  }
}) 