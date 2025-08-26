/**
 * RAG Statistics API Endpoint
 * 
 * This endpoint retrieves comprehensive statistics about an agent's RAG (Retrieval-Augmented Generation) system.
 * It provides information about:
 * - MongoDB context documents (count by type: file, url, website)
 * - Qdrant vector database collection status and metrics
 * - Detailed chunk analysis showing how documents are processed into RAG
 * - Summary statistics for the agent's knowledge base
 * 
 * Security: Requires agent read access via authMiddleware.agentAccess('read')
 * The agentId is validated and sanitized by the middleware before reaching this handler.
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
import { sanitizeErrorMessage } from '~/utils/sanitize.js'

export default chatwootAuthMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find the agent (permission already verified by middleware)
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
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
      statusMessage: sanitizeErrorMessage(error.message || 'Failed to get RAG statistics')
    })
  }
}) 