import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Require authentication
    const user = await requireAuth(event)

    // Get request body
    const body = await readBody(event)

    // Validate required fields
    if (!body.name || !body.prompt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name and prompt are required'
      })
    }

    // Create agent data
    const agentData = {
      name: body.name,
      description: body.description || '',
      prompt: body.prompt,
      settings: {
        temperature: body.settings?.temperature || 0.7,
        maxTokens: body.settings?.maxTokens || 500,
        responseDelay: body.settings?.responseDelay || 0
      },
      createdBy: user._id,
      isActive: true
    }

    // Create agent
    const agent = new Agent(agentData)
    await agent.save()

    // Populate createdBy field for response
    await agent.populate('createdBy', 'name email')

    return {
      success: true,
      data: agent
    }
  } catch (error: any) {
    console.error('Create agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to create agent'
    })
  }
}) 