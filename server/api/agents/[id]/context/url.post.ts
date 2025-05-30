import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import User from '~/server/models/User'
import webScrapingService from '~/server/services/webScrapingService'
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

    // Get request body
    const body = await readBody(event)
    const { url } = body

    if (!url || typeof url !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL is required and must be a string'
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

    // Check if URL already exists in context documents
    const existingDoc = agent.contextDocuments.find(doc => 
      doc.type === 'url' && doc.url === url
    )

    if (existingDoc) {
      throw createError({
        statusCode: 409,
        statusMessage: 'URL already exists in context documents'
      })
    }

    // Scrape content from URL
    let scrapedContent
    try {
      scrapedContent = await webScrapingService.scrapeUrl(url)
    } catch (error: any) {
      console.error('URL scraping failed:', error.message)
      throw createError({
        statusCode: 400,
        statusMessage: `Failed to fetch URL content: ${error.message}`
      })
    }

    // Create context document
    const contextDocument = {
      type: 'url' as const,
      content: scrapedContent.content,
      url: scrapedContent.url,
      filename: scrapedContent.title || new URL(scrapedContent.url).hostname,
      uploadedAt: new Date()
    }

    // Add to agent's context documents
    agent.contextDocuments.push(contextDocument)
    await agent.save()

    console.log(`Added URL context to agent ${agent.name}: ${scrapedContent.url} (${scrapedContent.content.length} characters)`)

    return {
      success: true,
      message: 'URL content added to agent context',
      data: {
        contextDocument: {
          type: contextDocument.type,
          url: contextDocument.url,
          filename: contextDocument.filename,
          uploadedAt: contextDocument.uploadedAt,
          contentLength: contextDocument.content.length,
          contentType: scrapedContent.contentType
        },
        agent: {
          _id: agent._id,
          name: agent.name,
          contextDocumentsCount: agent.contextDocuments.length
        }
      }
    }

  } catch (error: any) {
    console.error('Add URL context error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to add URL context'
    })
  }
}) 