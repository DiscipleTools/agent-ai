import Inbox from '~/server/models/Inbox'
import { getUserFromEvent } from '~/server/utils/auth'
import { z } from 'zod'

const updateAgentSchema = z.object({
  priority: z.number().int().min(1).max(999).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.any()).optional()
})

export default defineEventHandler(async (event) => {
  try {
    const user = getUserFromEvent(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const inboxId = getRouterParam(event, 'id')
    const agentId = getRouterParam(event, 'agentId')
    
    if (!inboxId || !agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Both inbox ID and agent ID are required'
      })
    }

    const body = await readBody(event)
    const updateData = updateAgentSchema.parse(body)

    // Find and validate inbox
    const inbox = await Inbox.findOne({
      _id: inboxId,
      createdBy: user.id || user._id
    })

    if (!inbox) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Inbox not found'
      })
    }

    // Find the agent in the agents array
    const agentIndex = inbox.agents.findIndex(a => a.agentId.toString() === agentId)
    if (agentIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent is not assigned to this inbox'
      })
    }

    const agentAssignment = inbox.agents[agentIndex]

    // Update the agent assignment
    if (updateData.priority !== undefined) {
      agentAssignment.priority = updateData.priority
    }
    
    if (updateData.isActive !== undefined) {
      agentAssignment.isActive = updateData.isActive
    }
    
    if (updateData.config !== undefined) {
      agentAssignment.config = { ...agentAssignment.config, ...updateData.config }
    }

    // Re-sort agents by priority if priority was changed
    if (updateData.priority !== undefined) {
      inbox.agents.sort((a, b) => a.priority - b.priority)
    }

    await inbox.save()

    // Populate agent details for response
    await inbox.populate('agents.agentId', 'name agentType description')

    const updatedAgent = inbox.agents.find(a => a.agentId._id.toString() === agentId)

    return {
      success: true,
      message: 'Agent configuration updated successfully',
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        updatedAgent: {
          agentId: updatedAgent.agentId._id,
          name: updatedAgent.name,
          agentType: updatedAgent.agentType,
          priority: updatedAgent.priority,
          isActive: updatedAgent.isActive,
          assignedAt: updatedAgent.assignedAt,
          config: updatedAgent.config
        },
        updateData
      }
    }

  } catch (error: any) {
    console.error('Error updating agent configuration:', error)
    
    if (error.statusCode) {
      throw error
    }

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid input data',
        data: { errors: error.errors }
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update agent configuration'
    })
  }
})