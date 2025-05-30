import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import mongoose from 'mongoose'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Verify authentication
    const user = await requireAuth(event)

    // Get agent ID and document ID from params
    const agentId = getRouterParam(event, 'id')
    const docId = getRouterParam(event, 'docId')
    
    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
      })
    }

    if (!docId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Document ID is required'
      })
    }

    // Find the agent
    const agent = await Agent.findById(agentId).select('name contextDocuments')
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Check if user has access to this agent
    if (user.role !== 'admin' && !user.agentAccess?.includes(new mongoose.Types.ObjectId(agentId))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied to this agent'
      })
    }

    // Find the context document
    const contextDoc = agent.contextDocuments.find(doc => doc._id?.toString() === docId)
    if (!contextDoc) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Context document not found'
      })
    }

    return {
      success: true,
      data: {
        _id: contextDoc._id,
        type: contextDoc.type,
        filename: contextDoc.filename,
        url: contextDoc.url,
        content: contextDoc.content,
        uploadedAt: contextDoc.uploadedAt,
        contentLength: contextDoc.content?.length || 0,
        agent: {
          _id: agent._id,
          name: agent.name
        }
      }
    }

  } catch (error: any) {
    console.error('Get context document error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get context document'
    })
  }
}) 