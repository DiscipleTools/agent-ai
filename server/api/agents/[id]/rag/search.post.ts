/**
 * RAG Search API Endpoint
 * 
 * This endpoint performs semantic search on an agent's RAG (Retrieval-Augmented Generation) 
 * collection using vector similarity. It searches through document chunks stored in the 
 * Qdrant vector database and returns the most relevant results based on the query.
 * 
 * Features:
 * - Semantic search across agent's context documents
 * - Configurable result limit (1-20 chunks)
 * - Relevance scoring and ranking
 * - Document grouping and summary
 * - Permission-based access control
 * 
 * @route POST /api/agents/[id]/rag/search
 * @requires Authentication and agent read access
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
import { sanitizeSearchQuery, sanitizeNumber, validators } from '~/utils/sanitize'

export default chatwootAuthMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { query, limit = 5 } = body

    // Validate and sanitize query parameter
    if (!query || typeof query !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Query is required and must be a string'
      })
    }

    // Sanitize query using utility function
    const sanitizedQuery = sanitizeSearchQuery(query)
    
    if (sanitizedQuery.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Query cannot be empty after sanitization'
      })
    }

    // Validate and sanitize limit parameter
    const sanitizedLimit = sanitizeNumber(limit)
    if (!validators.numberRange(sanitizedLimit, 1, 20)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Limit must be a number between 1 and 20'
      })
    }

    // Find the agent (permission already verified by middleware)
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Check if RAG collection exists
    const collectionInfo = await ragService.getCollectionInfo(agentId)
    if (!collectionInfo.exists || !collectionInfo.pointsCount || collectionInfo.pointsCount === 0) {
          return {
      success: true,
      message: 'No RAG data available for this agent',
      data: {
        query: sanitizedQuery,
        results: [],
        totalChunks: 0,
        collectionExists: collectionInfo.exists,
        totalPointsInCollection: collectionInfo.pointsCount || 0
      }
    }
    }

    // Perform RAG search
    const searchResults = await ragService.searchRelevantChunks(
      agentId,
      sanitizedQuery,
      sanitizedLimit
    )

    // Transform results for frontend
    const results = searchResults.map((chunk, index) => ({
      id: `${chunk.metadata.documentId}_${chunk.metadata.chunkIndex}`,
      text: chunk.text,
      score: chunk.score,
      relevancePercentage: Math.round(chunk.score * 100),
      documentTitle: chunk.metadata.documentTitle,
      documentType: chunk.metadata.documentType,
      chunkIndex: chunk.metadata.chunkIndex + 1,
      source: chunk.metadata.source,
      language: chunk.metadata.language,
      rank: index + 1
    }))

    // Group results by document for summary
    const documentSummary = results.reduce((acc, result) => {
      const docKey = `${result.documentTitle}_${result.documentType}`
      if (!acc[docKey]) {
        acc[docKey] = {
          title: result.documentTitle,
          type: result.documentType,
          source: result.source,
          chunks: 0,
          bestScore: 0
        }
      }
      acc[docKey].chunks++
      acc[docKey].bestScore = Math.max(acc[docKey].bestScore, result.score)
      return acc
    }, {} as Record<string, any>)

    return {
      success: true,
      message: `Found ${results.length} relevant chunks`,
      data: {
        query: sanitizedQuery,
        results,
        totalResults: results.length,
        totalChunks: collectionInfo.pointsCount,
        collectionExists: true,
        documentSummary: Object.values(documentSummary),
        searchMetadata: {
          limit: sanitizedLimit,
          agentId,
          agentName: agent.name,
          searchedAt: new Date().toISOString()
        }
      }
    }

  } catch (error: any) {
    console.error('RAG search error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to perform RAG search'
    })
  }
}) 