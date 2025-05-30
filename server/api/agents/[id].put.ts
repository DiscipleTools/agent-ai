import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Require authentication
    const user = await requireAuth(event)

    // Get agent ID from params
    const agentId = getRouterParam(event, 'id')

    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
      })
    }

    // Get request body
    const body = await readBody(event)

    // Find agent
    const agent = await Agent.findById(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Check access permissions
    if (user.role !== 'admin' && !user.agentAccess?.includes(new mongoose.Types.ObjectId(agentId))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    // Update agent fields
    if (body.name !== undefined) agent.name = body.name
    if (body.description !== undefined) agent.description = body.description
    if (body.prompt !== undefined) agent.prompt = body.prompt
    if (body.isActive !== undefined) agent.isActive = body.isActive
    
    // Update settings
    if (body.settings) {
      const currentSettings = (agent as any).settings || {}
      Object.assign(currentSettings, body.settings)
      ;(agent as any).settings = currentSettings
    }

    // Save agent
    await agent.save()

    // Populate createdBy field for response
    await agent.populate('createdBy', 'name email')

    return {
      success: true,
      data: agent
    }
  } catch (error: any) {
    console.error('Update agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to update agent'
    })
  }
}) 