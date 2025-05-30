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

    // Get agent ID from params
    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID is required'
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

    // Return context documents with metadata (excluding full content for performance)
    const contextDocuments = agent.contextDocuments.map(doc => ({
      _id: doc._id,
      type: doc.type,
      filename: doc.filename,
      url: doc.url,
      uploadedAt: doc.uploadedAt,
      contentLength: doc.content?.length || 0,
      contentPreview: doc.content?.substring(0, 200) + (doc.content?.length > 200 ? '...' : '')
    }))

    return {
      success: true,
      data: {
        agentId: agent._id,
        agentName: agent.name,
        contextDocuments,
        totalDocuments: contextDocuments.length,
        totalContentLength: agent.contextDocuments.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
      }
    }

  } catch (error: any) {
    console.error('List context documents error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to list context documents'
    })
  }
}) 