/**
 * GET /api/agents/[id]
 * 
 * Retrieves a specific agent by ID with enhanced context document information.
 * This endpoint:
 * - Validates user authentication and agent access permissions via middleware
 * - Fetches the agent from the database with populated creator information
 * - Enhances context documents with RAG (Retrieval-Augmented Generation) status
 * - Provides document previews and metadata for each context document
 * - Returns a comprehensive agent object with RAG summary statistics
 * 
 * Security: Uses authMiddleware.agentAccess('read') for authorization
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
import { sanitizeContent, sanitizeObjectId, sanitizeFilename, sanitizeUrl, sanitizeObject, sanitizeErrorMessage } from '~/utils/sanitize'

export default chatwootAuthMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find agent - limit populated fields for security
    const agent = await Agent.findById(agentId).populate('createdBy', 'name email -_id')

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Enhance context documents with RAG status and previews
    const contextDocumentsWithRAG = await Promise.all(
      agent.contextDocuments.map(async (doc: any) => {
        const sanitizedDocId = sanitizeObjectId(doc._id?.toString() || '')
        const ragStatus = await ragService.getDocumentRAGStatus(agentId, sanitizedDocId)
        
        return {
          _id: doc._id,
          type: doc.type,
          filename: sanitizeFilename(doc.filename || ''),
          url: sanitizeUrl(doc.url || ''),
          uploadedAt: doc.uploadedAt,
          contentLength: doc.content?.length || 0,
          // Remove full content from response - only provide preview for security
          contentPreview: sanitizeContent(doc.content?.substring(0, 200) + (doc.content?.length > 200 ? '...' : '')),
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
    
    // Sanitize error message for user display
    const sanitizedMessage = error.statusCode === 404 
      ? 'Agent not found' 
      : sanitizeErrorMessage(error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: sanitizedMessage
    })
  }
}) 