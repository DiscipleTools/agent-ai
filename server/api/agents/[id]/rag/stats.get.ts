import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
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
    const agent = await Agent.findById(agentId)
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

    // Get RAG collection information
    const collectionInfo = await ragService.getCollectionInfo(agentId)

    // Count context documents in MongoDB
    const mongoDocuments = agent.contextDocuments || []
    const documentsByType = {
      file: mongoDocuments.filter((doc: any) => doc.type === 'file').length,
      url: mongoDocuments.filter((doc: any) => doc.type === 'url').length,
      website: mongoDocuments.filter((doc: any) => doc.type === 'website').length
    }

    // Get detailed statistics if collection exists
    let detailedStats = null
    if (collectionInfo.exists && collectionInfo.pointsCount && collectionInfo.pointsCount > 0) {
      try {
        // Try to get some sample chunks to analyze distribution
        const sampleChunks = await ragService.searchRelevantChunks(
          agentId,
          'sample query to get any chunks',
          50 // Get more chunks for analysis
        )

        // Analyze chunks by document type and title
        const chunksByType = {
          file: 0,
          url: 0,
          website: 0
        }
        const chunksByDocument = new Map()

        sampleChunks.forEach(chunk => {
          chunksByType[chunk.metadata.documentType] = (chunksByType[chunk.metadata.documentType] || 0) + 1
          
          const docKey = `${chunk.metadata.documentType}:${chunk.metadata.documentTitle}`
          chunksByDocument.set(docKey, (chunksByDocument.get(docKey) || 0) + 1)
        })

        detailedStats = {
          chunksByType,
          totalDocumentsWithChunks: chunksByDocument.size,
          documentChunkCounts: Array.from(chunksByDocument.entries()).map(([docKey, count]) => {
            const [type, title] = docKey.split(':')
            return { type, title, chunks: count }
          })
        }
      } catch (error) {
        console.warn('Failed to get detailed RAG stats:', error)
      }
    }

    return {
      success: true,
      message: 'RAG statistics retrieved successfully',
      data: {
        agent: {
          _id: agent._id,
          name: agent.name
        },
        mongoDocuments: {
          total: mongoDocuments.length,
          byType: documentsByType
        },
        ragCollection: {
          exists: collectionInfo.exists,
          pointsCount: collectionInfo.pointsCount || 0,
          vectorsCount: collectionInfo.vectorsCount || 0,
          collectionName: collectionInfo.exists ? `agent_${agentId}` : null
        },
        detailed: detailedStats,
        summary: {
          mongoDocumentsCount: mongoDocuments.length,
          ragChunksCount: collectionInfo.pointsCount || 0,
          ragAvailable: collectionInfo.exists && (collectionInfo.pointsCount || 0) > 0,
          documentsProcessedIntoRAG: detailedStats?.totalDocumentsWithChunks || 0
        }
      }
    }

  } catch (error: any) {
    console.error('Get RAG stats error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get RAG statistics'
    })
  }
}) 