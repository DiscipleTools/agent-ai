import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
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

    // Get request body
    const body = await readBody(event)
    const { url, options = {} } = body

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

    // Defensive check: Ensure createdBy field exists (fix for legacy agents)
    if (!agent.createdBy) {
      console.warn(`Agent ${agent.name} missing createdBy field, setting to current user`)
      agent.createdBy = user._id
    }

    // Check if user has access to this agent
    if (user.role !== 'admin' && !user.agentAccess?.includes(new mongoose.Types.ObjectId(agentId))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied to this agent'
      })
    }

    // Validate crawl options
    const crawlOptions = {
      maxPages: Math.min(options.maxPages || 200, 200), // Cap at 200 pages
      maxDepth: Math.min(options.maxDepth || 2, 3), // Cap at 3 levels deep
      sameDomainOnly: options.sameDomainOnly !== false, // Default to true
      includePatterns: Array.isArray(options.includePatterns) ? options.includePatterns : [],
      excludePatterns: Array.isArray(options.excludePatterns) ? options.excludePatterns : []
    }

    // Check if website already exists in context documents
    const existingWebsiteDoc = agent.contextDocuments.find((doc: any) => 
      doc.type === 'website' && doc.url === url
    )

    if (existingWebsiteDoc) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Website already exists in context documents'
      })
    }

    // Crawl the website
    let websiteContent
    try {
      console.log(`Starting website crawl for agent ${agent.name}: ${url}`)
      websiteContent = await webScrapingService.crawlWebsite(url, crawlOptions)
    } catch (error: any) {
      console.error('Website crawling failed:', error.message)
      throw createError({
        statusCode: 400,
        statusMessage: `Failed to crawl website: ${error.message}`
      })
    }

    // Combine all page content into a single document
    let combinedContent = `${websiteContent.summary}\n\n`
    combinedContent += `=== WEBSITE CONTENT ===\n\n`
    
    websiteContent.pages.forEach((page, index) => {
      combinedContent += `--- Page ${index + 1}: ${page.title || 'Untitled'} ---\n`
      combinedContent += `URL: ${page.url}\n`
      combinedContent += `${page.content}\n\n`
    })

    // Create context document for the website
    const contextDocument = {
      type: 'website' as const,
      content: combinedContent,
      url: websiteContent.baseUrl,
      filename: `${new URL(websiteContent.baseUrl).hostname} (${websiteContent.totalPages} pages)`,
      uploadedAt: new Date(),
      metadata: {
        totalPages: websiteContent.totalPages,
        totalContentLength: websiteContent.totalContentLength,
        crawlOptions,
        pageUrls: websiteContent.pages.map(page => page.url)
      }
    }

    // Add to agent's context documents
    agent.contextDocuments.push(contextDocument)
    await agent.save()

    // Get the document ID for RAG processing
    const savedDocument = agent.contextDocuments[agent.contextDocuments.length - 1]
    const documentId = savedDocument._id?.toString()

    console.log(`Added website context to agent ${agent.name}: ${websiteContent.baseUrl} (${websiteContent.totalPages} pages, ${websiteContent.totalContentLength} characters)`)

    // Process document for RAG (vector embeddings)
    let ragInfo = null
    try {
      if (documentId) {
        const ragResult = await ragService.processDocument(
          agentId,
          documentId,
          combinedContent,
          {
            type: 'website',
            title: contextDocument.filename,
            source: websiteContent.baseUrl
          }
        )
        ragInfo = {
          chunksCreated: ragResult.chunksCreated,
          collectionName: ragResult.collectionName
        }
        console.log(`✅ RAG processing completed: ${ragResult.chunksCreated} chunks created for website`)
      }
    } catch (ragError) {
      console.error('RAG processing failed (non-critical):', ragError)
      // RAG failure is non-critical - document is still saved to MongoDB
    }

    return {
      success: true,
      message: `Website content added to agent context (${websiteContent.totalPages} pages crawled)`,
      data: {
        contextDocument: {
          type: contextDocument.type,
          url: contextDocument.url,
          filename: contextDocument.filename,
          uploadedAt: contextDocument.uploadedAt,
          contentLength: contextDocument.content.length,
          metadata: {
            totalPages: websiteContent.totalPages,
            totalContentLength: websiteContent.totalContentLength,
            crawlOptions,
            pageCount: websiteContent.pages.length
          }
        },
        website: {
          baseUrl: websiteContent.baseUrl,
          totalPages: websiteContent.totalPages,
          totalContentLength: websiteContent.totalContentLength,
          summary: websiteContent.summary,
          pageUrls: websiteContent.pages.map(page => ({ url: page.url, title: page.title }))
        },
        agent: {
          _id: agent._id,
          name: agent.name,
          contextDocumentsCount: agent.contextDocuments.length
        },
        rag: ragInfo
      }
    }

  } catch (error: any) {
    console.error('Add website context error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to add website context'
    })
  }
}) 