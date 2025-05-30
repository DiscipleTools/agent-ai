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

    // Handle website re-crawl
    if (refreshUrl && contextDoc.type === 'website' && contextDoc.url) {
      try {
        console.log(`Re-crawling website for: ${contextDoc.url}`)
        
        // Use the original crawl options if available, otherwise use defaults
        const originalOptions = contextDoc.metadata?.crawlOptions || {
          maxPages: 10,
          maxDepth: 2,
          sameDomainOnly: true
        }
        
        const websiteContent = await webScrapingService.crawlWebsite(contextDoc.url, originalOptions)
        
        // Combine all page content into a single document (same format as original)
        let combinedContent = `${websiteContent.summary}\n\n`
        combinedContent += `=== WEBSITE CONTENT ===\n\n`
        
        websiteContent.pages.forEach((page, index) => {
          combinedContent += `--- Page ${index + 1}: ${page.title || 'Untitled'} ---\n`
          combinedContent += `URL: ${page.url}\n`
          combinedContent += `${page.content}\n\n`
        })
        
        updatedContent = combinedContent
        updatedFilename = `${new URL(websiteContent.baseUrl).hostname} (${websiteContent.totalPages} pages)`
        
        // Update metadata with new crawl information
        const updatedMetadata = {
          ...contextDoc.metadata,
          totalPages: websiteContent.totalPages,
          totalContentLength: websiteContent.totalContentLength,
          pageUrls: websiteContent.pages.map(page => page.url),
          lastCrawled: new Date()
        }
        
        // Update the document with new metadata
        agent.contextDocuments[docIndex] = {
          ...contextDoc,
          content: updatedContent,
          filename: updatedFilename,
          uploadedAt: new Date(),
          metadata: updatedMetadata
        }
        
        await agent.save()
        
        console.log(`Website re-crawled: ${websiteContent.totalPages} pages, ${websiteContent.totalContentLength} characters`)
        
        const updatedDoc = agent.contextDocuments[docIndex]
        
        return {
          success: true,
          message: `Website re-crawled successfully (${websiteContent.totalPages} pages)`,
          data: {
            contextDocument: {
              _id: updatedDoc._id,
              type: updatedDoc.type,
              filename: updatedDoc.filename,
              url: updatedDoc.url,
              uploadedAt: updatedDoc.uploadedAt,
              contentLength: updatedDoc.content?.length || 0,
              contentPreview: updatedDoc.content?.substring(0, 200) + (updatedDoc.content?.length > 200 ? '...' : ''),
              metadata: updatedDoc.metadata
            },
            agent: {
              _id: agent._id,
              name: agent.name,
              contextDocumentsCount: agent.contextDocuments.length
            }
          }
        }
        
      } catch (error: any) {
        console.error('Website re-crawl failed:', error.message)
        throw createError({
          statusCode: 400,
          statusMessage: `Failed to re-crawl website: ${error.message}`
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