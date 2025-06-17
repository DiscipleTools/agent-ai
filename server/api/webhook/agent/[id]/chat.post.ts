import { connectDB } from '~/server/utils/db'
import Agent from '~/server/models/Agent'
import aiService from '~/server/services/aiService'

interface AgentSettings {
  temperature?: number
  maxTokens?: number
  responseDelay?: number
  connectionId?: string
  modelId?: string
  chatwootApiKey?: string
}

interface AgentDocument {
  _id: string
  name: string
  prompt: string
  webhookUrl: string
  contextDocuments?: Array<{
    type: 'file' | 'url'
    content: string
    filename?: string
    url?: string
  }>
  settings?: AgentSettings
  isActive: boolean
}

export default defineEventHandler(async (event) => {
  try {
    // Only allow POST requests
    if (getMethod(event) !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }

    // Connect to database
    await connectDB()

    // Get agent ID from params
    const agentId = getRouterParam(event, 'id')
    
    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
      })
    }

    // Find agent by webhook URL (using the same approach as the original webhook)
    const webhookUrl = `/api/webhook/agent/${agentId}`
    const agent = await Agent.findOne({ webhookUrl, isActive: true }) as AgentDocument | null

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found or inactive'
      })
    }

    // Get request payload
    const payload = await readBody(event)

    // Validate payload
    if (!payload || typeof payload !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid payload: expected JSON object'
      })
    }

    // Extract message from payload
    const messageContent = payload.message

    if (!messageContent || typeof messageContent !== 'string' || !messageContent.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid payload: message field is required and must be a non-empty string'
      })
    }

    console.log('Chat request received for agent:', agent.name)
    console.log('Message length:', messageContent.length, 'characters')

    // Generate AI response using the agent's prompt and context
    let responseMessage: string
    
    try {
      responseMessage = await aiService.generateResponse(
        agent._id,
        agent.prompt,
        agent.contextDocuments || [],
        messageContent.trim(),
        {
          temperature: agent.settings?.temperature,
          maxTokens: agent.settings?.maxTokens,
          responseDelay: agent.settings?.responseDelay,
          connectionId: agent.settings?.connectionId?.toString(),
          modelId: agent.settings?.modelId
        }
      )
      
      console.log('AI response generated for chat:', {
        agentName: agent.name,
        responseLength: responseMessage.length,
        originalMessageLength: messageContent.length
      })
      
    } catch (aiError: any) {
      console.error('AI generation failed for chat:', aiError)
      
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to generate AI response',
        data: {
          error: aiError.message || 'AI service error'
        }
      })
    }

    // Add configured delay if any
    if (agent.settings?.responseDelay && agent.settings.responseDelay > 0) {
      console.log(`Adding ${agent.settings.responseDelay} seconds delay before responding...`)
      await aiService.delay(agent.settings.responseDelay * 1000)
    }

    // Return the AI response directly
    return {
      success: true,
      message: responseMessage,
      data: {
        agentId: agent._id,
        agentName: agent.name,
        originalMessageLength: messageContent.length,
        responseLength: responseMessage.length,
        hasContextDocuments: (agent.contextDocuments || []).length > 0
      }
    }

  } catch (error: any) {
    console.error('Chat endpoint error:', error)
    
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }
    
    // Otherwise, return a generic 500 error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: {
        error: error.message || 'Unknown error'
      }
    })
  }
}) 