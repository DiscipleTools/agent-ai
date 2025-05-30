import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
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

    // Get request body
    const body = await readBody(event)
    const { content, filename, refreshUrl } = body

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

    // Find the context document
    const docIndex = agent.contextDocuments.findIndex(doc => doc._id?.toString() === docId)
    if (docIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Context document not found'
      })
    }

    const contextDoc = agent.contextDocuments[docIndex]
    let updatedContent = contextDoc.content
    let updatedFilename = contextDoc.filename

    // Handle URL refresh
    if (refreshUrl && contextDoc.type === 'url' && contextDoc.url) {
      try {
        console.log(`Refreshing URL content for: ${contextDoc.url}`)
        const scrapedContent = await webScrapingService.scrapeUrl(contextDoc.url)
        updatedContent = scrapedContent.content
        updatedFilename = scrapedContent.title || contextDoc.filename
        
        console.log(`URL content refreshed: ${scrapedContent.content.length} characters`)
      } catch (error: any) {
        console.error('URL refresh failed:', error.message)
        throw createError({
          statusCode: 400,
          statusMessage: `Failed to refresh URL content: ${error.message}`
        })
      }
    }

    // Handle manual content update
    if (content !== undefined) {
      if (typeof content !== 'string') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Content must be a string'
        })
      }

      if (content.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Content cannot be empty'
        })
      }

      if (content.length > 100000) { // 100KB limit
        throw createError({
          statusCode: 400,
          statusMessage: 'Content too large (max 100KB)'
        })
      }

      updatedContent = content.trim()
    }

    // Handle filename update
    if (filename !== undefined) {
      if (typeof filename !== 'string') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Filename must be a string'
        })
      }
      updatedFilename = filename.trim()
    }

    // Update the document
    agent.contextDocuments[docIndex] = {
      ...contextDoc,
      content: updatedContent,
      filename: updatedFilename,
      uploadedAt: refreshUrl ? new Date() : contextDoc.uploadedAt // Update timestamp only if refreshed
    }

    await agent.save()

    const updatedDoc = agent.contextDocuments[docIndex]

    console.log(`Updated context document for agent ${agent.name}: ${updatedDoc.type} - ${updatedDoc.filename || updatedDoc.url}`)

    return {
      success: true,
      message: refreshUrl ? 'Context document refreshed successfully' : 'Context document updated successfully',
      data: {
        contextDocument: {
          _id: updatedDoc._id,
          type: updatedDoc.type,
          filename: updatedDoc.filename,
          url: updatedDoc.url,
          uploadedAt: updatedDoc.uploadedAt,
          contentLength: updatedDoc.content?.length || 0,
          contentPreview: updatedDoc.content?.substring(0, 200) + (updatedDoc.content?.length > 200 ? '...' : '')
        },
        agent: {
          _id: agent._id,
          name: agent.name,
          contextDocumentsCount: agent.contextDocuments.length
        }
      }
    }

  } catch (error: any) {
    console.error('Update context document error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update context document'
    })
  }
}) 