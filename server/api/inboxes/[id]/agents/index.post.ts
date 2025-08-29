import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import { requireChatwootAuth } from '~/server/utils/auth'
import { z } from 'zod'

const addAgentSchema = z.object({
  agentId: z.string().length(24), // MongoDB ObjectId length
  priority: z.number().int().min(1).max(999).optional().default(100),
  config: z.record(z.any()).optional().default({})
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireChatwootAuth(event)

    const inboxId = getRouterParam(event, 'id')
    if (!inboxId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Inbox ID is required'
      })
    }

    const body = await readBody(event)
    const { agentId, priority, config } = addAgentSchema.parse(body)

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

    // Find and validate agent
    const agent = await Agent.findOne({
      _id: agentId,
      createdBy: user.id || user._id,
      isActive: true
    })

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Validate that response agents cannot be added to agents array
    if (agent.agentType === 'response') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Response agents must be assigned as response agent, not in processing pipeline'
      })
    }

    // Check if agent is already assigned as response agent
    if (inbox.responseAgent?.agentId?.toString() === agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent is already assigned as response agent. Cannot add to processing pipeline.'
      })
    }

    // Check if agent is already in agents array
    const existingAgent = inbox.agents.find(a => a.agentId.toString() === agentId)
    if (existingAgent) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Agent is already assigned to this inbox'
      })
    }

    // Add agent to agents array
    inbox.addAgent(agentId, agent.agentType, agent.name, priority, config)
    await inbox.save()

    // Get the newly added agent assignment for response
    const addedAgent = inbox.agents.find(a => a.agentId.toString() === agentId)
    
    // Populate agent details
    await inbox.populate('agents.agentId', 'name agentType description')

    return {
      success: true,
      message: 'Agent added to processing pipeline successfully',
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        addedAgent: {
          agentId: addedAgent.agentId,
          name: addedAgent.name,
          agentType: addedAgent.agentType,
          priority: addedAgent.priority,
          isActive: addedAgent.isActive,
          assignedAt: addedAgent.assignedAt,
          config: addedAgent.config
        },
        summary: {
          totalAgents: inbox.agents.length,
          activeAgents: inbox.agents.filter(a => a.isActive).length
        }
      }
    }

  } catch (error: any) {
    console.error('Error adding agent to inbox:', error)
    
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

    // Handle mongoose errors from addAgent method
    if (error.message?.includes('already assigned')) {
      throw createError({
        statusCode: 409,
        statusMessage: error.message
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add agent to inbox'
    })
  }
})