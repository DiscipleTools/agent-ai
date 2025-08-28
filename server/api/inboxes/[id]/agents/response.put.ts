import Inbox from '~/server/models/Inbox'
import Agent from '~/server/models/Agent'
import { requireChatwootAuth } from '~/server/utils/auth'
import { z } from 'zod'

const assignResponseAgentSchema = z.object({
  agentId: z.string().length(24), // MongoDB ObjectId length
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
    const { agentId, config } = assignResponseAgentSchema.parse(body)

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

    // Validate that agent is a response type
    if (agent.agentType !== 'response') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Only response agents can be assigned as response agent'
      })
    }

    // Check if agent is already in the agents array (response agents should not be in both places)
    const existingInAgentsArray = inbox.agents.find(a => a.agentId.toString() === agentId)
    if (existingInAgentsArray) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Response agent cannot be assigned to agents array. Remove from agents array first.'
      })
    }

    // Assign response agent
    inbox.assignResponseAgent(agentId, config)
    await inbox.save()

    // Populate agent details before returning
    await inbox.populate('responseAgent.agentId', 'name agentType description')

    return {
      success: true,
      message: 'Response agent assigned successfully',
      data: {
        inbox: {
          id: inbox._id,
          name: inbox.name
        },
        responseAgent: {
          agentId: inbox.responseAgent.agentId._id,
          name: inbox.responseAgent.agentId.name,
          agentType: inbox.responseAgent.agentId.agentType,
          assignedAt: inbox.responseAgent.assignedAt,
          config: inbox.responseAgent.config
        }
      }
    }

  } catch (error: any) {
    console.error('Error assigning response agent:', error)
    
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
      statusMessage: 'Failed to assign response agent'
    })
  }
})