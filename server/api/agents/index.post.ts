import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import User from '~/server/models/User'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Require authentication
    const user = await requireAuth(event)

    // Get request body
    const body = await readBody(event)

    // Enhanced validation
    const errors = []

    if (!body.name || !body.name.trim()) {
      errors.push('Agent name is required')
    } else if (body.name.length > 100) {
      errors.push('Agent name cannot exceed 100 characters')
    }

    if (!body.prompt || !body.prompt.trim()) {
      errors.push('System prompt is required')
    } else if (body.prompt.length < 10) {
      errors.push('Prompt must be at least 10 characters long')
    } else if (body.prompt.length > 2000) {
      errors.push('Prompt cannot exceed 2000 characters')
    }

    if (body.description && body.description.length > 500) {
      errors.push('Description cannot exceed 500 characters')
    }

    // Validate settings
    if (body.settings) {
      if (body.settings.temperature !== undefined) {
        const temp = Number(body.settings.temperature)
        if (isNaN(temp) || temp < 0 || temp > 1) {
          errors.push('Temperature must be between 0 and 1')
        }
      }

      if (body.settings.maxTokens !== undefined) {
        const tokens = Number(body.settings.maxTokens)
        if (isNaN(tokens) || tokens < 1 || tokens > 2000) {
          errors.push('Max tokens must be between 1 and 2000')
        }
      }

      if (body.settings.responseDelay !== undefined) {
        const delay = Number(body.settings.responseDelay)
        if (isNaN(delay) || delay < 0 || delay > 30) {
          errors.push('Response delay must be between 0 and 30 seconds')
        }
      }

      // Validate connectionId and modelId if provided
      if (body.settings.connectionId && !mongoose.Types.ObjectId.isValid(body.settings.connectionId)) {
        errors.push('Invalid connection ID format')
      }
    }

    if (errors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: errors.join(', ')
      })
    }

    // Create agent data
    const agentData = {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      prompt: body.prompt.trim(),
      settings: {
        temperature: body.settings?.temperature !== undefined ? Number(body.settings.temperature) : 0.3,
        maxTokens: body.settings?.maxTokens !== undefined ? Number(body.settings.maxTokens) : 500,
        responseDelay: body.settings?.responseDelay !== undefined ? Number(body.settings.responseDelay) : 0,
        connectionId: body.settings?.connectionId || null,
        modelId: body.settings?.modelId || null
      },
      createdBy: user._id,
      isActive: true
    }

    // Create agent
    const agent = new Agent(agentData)
    await agent.save()

    // Grant the creating user access to the new agent (unless they're admin - admins have access to all)
    if (user.role !== 'admin') {
      await User.findByIdAndUpdate(
        user._id,
        { $addToSet: { agentAccess: agent._id } },
        { new: true }
      )
    }

    // Populate createdBy field for response
    await agent.populate('createdBy', 'name email')

    return {
      success: true,
      data: agent
    }
  } catch (error: any) {
    console.error('Create agent error:', error)
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message)
      throw createError({
        statusCode: 400,
        statusMessage: validationErrors.join(', ')
      })
    }

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to create agent'
    })
  }
}) 