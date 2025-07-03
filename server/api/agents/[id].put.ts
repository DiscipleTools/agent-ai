import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import mongoose from 'mongoose'

export default authMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

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



    // Update agent fields
    if (body.name !== undefined) agent.name = body.name
    if (body.description !== undefined) agent.description = body.description
    if (body.prompt !== undefined) agent.prompt = body.prompt
    if (body.isActive !== undefined) agent.isActive = body.isActive
    
    // Update settings
    if (body.settings) {
      const currentSettings = (agent as any).settings || {}
      Object.assign(currentSettings, body.settings)
      
      // Validate connectionId if provided
      if (body.settings.connectionId && !mongoose.Types.ObjectId.isValid(body.settings.connectionId)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid connection ID format'
        })
      }
      
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