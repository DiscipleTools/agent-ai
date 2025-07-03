import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
import mongoose from 'mongoose'

export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find agent
    const agent = await Agent.findById(agentId).populate('createdBy', 'name email')

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Enhance context documents with RAG status and previews
    const contextDocumentsWithRAG = await Promise.all(
      agent.contextDocuments.map(async (doc: any) => {
        const ragStatus = await ragService.getDocumentRAGStatus(agentId, doc._id?.toString() || '')
        
        return {
          _id: doc._id,
          type: doc.type,
          filename: doc.filename,
          url: doc.url,
          uploadedAt: doc.uploadedAt,
          contentLength: doc.content?.length || 0,
          content: doc.content,
          contentPreview: doc.content?.substring(0, 200) + (doc.content?.length > 200 ? '...' : ''),
          metadata: doc.metadata,
          rag: {
            inRAG: ragStatus.inRAG,
            chunksCount: ragStatus.chunksCount
          }
        }
      })
    )

    // Create enhanced agent object with RAG summary
    const enhancedAgent = {
      ...agent.toObject(),
      contextDocuments: contextDocumentsWithRAG,
      ragSummary: {
        totalDocuments: contextDocumentsWithRAG.length,
        documentsInRAG: contextDocumentsWithRAG.filter((doc: any) => doc.rag.inRAG).length,
        totalChunks: contextDocumentsWithRAG.reduce((sum: number, doc: any) => sum + doc.rag.chunksCount, 0)
      }
    }

    return {
      success: true,
      data: enhancedAgent
    }
  } catch (error: any) {
    console.error('Get agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch agent'
    })
  }
}) 