import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import { ragService } from '~/server/services/ragService'
import mongoose from 'mongoose'

export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { query, limit = 5 } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Query is required and must be a non-empty string'
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
          query: query.trim(),
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
      query.trim(),
      Math.min(Math.max(1, parseInt(limit) || 5), 20) // Limit between 1-20
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
        query: query.trim(),
        results,
        totalResults: results.length,
        totalChunks: collectionInfo.pointsCount,
        collectionExists: true,
        documentSummary: Object.values(documentSummary),
        searchMetadata: {
          limit: Math.min(Math.max(1, parseInt(limit) || 5), 20),
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