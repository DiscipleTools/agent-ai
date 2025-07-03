/**
 * API endpoint for adding website content to an agent's context documents.
 * 
 * This endpoint crawls a website (with configurable depth and page limits),
 * extracts the content, stores it as a context document in the agent's MongoDB record,
 * and processes it through the RAG system for vector embeddings.
 * 
 * Uses streaming (SSE) for real-time progress updates during crawling.
 * Includes SSRF protection and access control validation.
 * 
 * @route POST /api/agents/[id]/context/website
 * @param {string} url - The website URL to crawl
 * @param {object} options - Crawl configuration (maxPages, maxDepth, patterns, etc.)
 */

import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import { validateUrlOrThrow } from '~/server/utils/urlValidator'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
import { ragService } from '~/server/services/ragService'
import { sanitizeContent, sanitizeUrl, sanitizeText, sanitizeErrorMessage } from '~/utils/sanitize.js'
import mongoose from 'mongoose'

// Security constants
const MAX_CONTENT_SIZE = 10 * 1024 * 1024 // 10MB total content limit
const MAX_PAGE_SIZE = 1024 * 1024 // 1MB per page limit
const CRAWL_TIMEOUT = 30000 // 30 second timeout per page
const MAX_TOTAL_CRAWL_TIME = 600000 // 10 minute total crawl limit

// Helper function to create event stream for SSE
function createEventStream(event: any) {
  setHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  const encoder = new TextEncoder()
  let closed = false

  return {
    push: async (data: string) => {
      if (closed) return
      try {
        const formattedData = `data: ${data}\n\n`
        const chunk = encoder.encode(formattedData)
        // Send the chunk - this is handled by Nuxt's event system
        await event.node.res.write(chunk)
      } catch (error) {
        console.error('Error writing to stream:', error)
        closed = true
      }
    },
    close: () => {
      if (closed) return
      closed = true
      try {
        event.node.res.end()
      } catch (error) {
        console.error('Error closing stream:', error)
      }
    },
    send: () => {
      // Return a promise that never resolves to keep the connection open
      return new Promise(() => {})
    }
  }
}

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

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid agent ID format'
      })
    }

    // Get request body
    const body = await readBody(event)
    const { url: rawUrl, options = {} } = body

    if (!rawUrl || typeof rawUrl !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL is required and must be a string'
      })
    }

    // Sanitize the URL input
    const url = sanitizeUrl(rawUrl)
    if (!url) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid URL provided'
      })
    }

    // Validate URL for security (prevent SSRF attacks)
    try {
      validateUrlOrThrow(url)
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message
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

    // Validate crawl options with security limits and sanitization
    const crawlOptions = {
      maxPages: Math.min(Math.max(parseInt(options.maxPages) || 200, 1), 200), // Cap at 200 pages, min 1
      maxDepth: Math.min(Math.max(parseInt(options.maxDepth) || 2, 1), 3), // Cap at 3 levels deep, min 1
      sameDomainOnly: options.sameDomainOnly !== false, // Default to true
      includePatterns: Array.isArray(options.includePatterns) 
        ? (options.includePatterns as string[]).map(pattern => sanitizeText(pattern)).filter(Boolean)
        : [],
      excludePatterns: Array.isArray(options.excludePatterns) 
        ? (options.excludePatterns as string[]).map(pattern => sanitizeText(pattern)).filter(Boolean)
        : [],
      timeout: CRAWL_TIMEOUT, // Per-page timeout
      maxTotalTime: MAX_TOTAL_CRAWL_TIME, // Total crawl time limit
      maxPageSize: MAX_PAGE_SIZE, // Individual page size limit
      maxTotalSize: MAX_CONTENT_SIZE // Total content size limit
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

    // Always use streaming mode for website crawling
    const eventStream = createEventStream(event)

    // Handle the crawling in the background
    const handleCrawling = async () => {
        try {
          // Send initial progress
          await eventStream.push(JSON.stringify({
            type: 'progress',
            phase: 'starting',
            message: 'Starting website crawl...',
            currentPage: 0,
            totalPages: crawlOptions.maxPages,
            percentage: 0
          }))

          // Crawl the website with progress callbacks
          console.log(`Starting website crawl for agent ${agent.name}: ${url}`)
          
          const websiteContent = await webScrapingService.crawlWebsiteWithProgress(url, crawlOptions, async (progress: any) => {
            await eventStream.push(JSON.stringify({
              type: 'progress',
              phase: 'crawling',
              message: progress.message,
              currentPage: progress.currentPage,
              totalPages: progress.estimatedTotal || crawlOptions.maxPages,
              percentage: Math.round((progress.currentPage / (progress.estimatedTotal || crawlOptions.maxPages)) * 100),
              currentUrl: progress.currentUrl
            }))
          })

          // Send processing phase
          await eventStream.push(JSON.stringify({
            type: 'progress',
            phase: 'processing',
            message: 'Processing crawled content...',
            currentPage: websiteContent.totalPages,
            totalPages: websiteContent.totalPages,
            percentage: 95
          }))

          // Combine all page content into a single document with size validation
          let combinedContent = `${websiteContent.summary}\n\n`
          combinedContent += `=== WEBSITE CONTENT ===\n\n`
          
          websiteContent.pages.forEach((page: any, index: number) => {
            // Sanitize and validate individual page size
            if (page.content) {
              page.content = sanitizeContent(page.content)
              if (page.content.length > MAX_PAGE_SIZE) {
                console.warn(`Page ${index + 1} exceeds size limit, truncating...`)
                page.content = page.content.substring(0, MAX_PAGE_SIZE) + '\n\n[Content truncated due to size limit]'
              }
            }
            
            const pageContent = `--- Page ${index + 1}: ${page.title || 'Untitled'} ---\n`
              + `URL: ${page.url}\n`
              + `${page.content}\n\n`
            
            // Check if adding this page would exceed total size limit
            if (combinedContent.length + pageContent.length > MAX_CONTENT_SIZE) {
              combinedContent += `\n\n[Additional pages truncated due to total content size limit]`
              return
            }
            
            combinedContent += pageContent
          })
          
          // Final size check
          if (combinedContent.length > MAX_CONTENT_SIZE) {
            combinedContent = combinedContent.substring(0, MAX_CONTENT_SIZE) + '\n\n[Content truncated due to size limit]'
          }

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
              pageUrls: websiteContent.pages.map((page: any) => page.url)
            }
          }

          // Add to agent's context documents
          agent.contextDocuments.push(contextDocument)
          await agent.save()

          // Get the document ID for RAG processing
          const savedDocument = agent.contextDocuments[agent.contextDocuments.length - 1]
          const documentId = savedDocument._id?.toString()

          console.log(`Added website context to agent ${agent.name}: ${websiteContent.baseUrl} (${websiteContent.totalPages} pages, ${websiteContent.totalContentLength} characters)`)

          // Send RAG processing phase
          await eventStream.push(JSON.stringify({
            type: 'progress',
            phase: 'rag',
            message: 'Creating vector embeddings...',
            currentPage: websiteContent.totalPages,
            totalPages: websiteContent.totalPages,
            percentage: 98
          }))

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
              
              // Update document metadata with RAG status
              const docIndex = agent.contextDocuments.length - 1
              agent.contextDocuments[docIndex].metadata = {
                ...agent.contextDocuments[docIndex].metadata,
                rag: {
                  processed: true,
                  chunksCreated: ragResult.chunksCreated,
                  processedAt: new Date()
                }
              }
              await agent.save()
              
              console.log(`✅ RAG processing completed: ${ragResult.chunksCreated} chunks created for website`)
            }
          } catch (ragError: any) {
            console.error('RAG processing failed (non-critical):', ragError)
            
            // Update document metadata to indicate RAG processing failed
            const docIndex = agent.contextDocuments.length - 1
            agent.contextDocuments[docIndex].metadata = {
              ...agent.contextDocuments[docIndex].metadata,
              rag: {
                processed: false,
                error: ragError.message || 'RAG processing failed',
                attemptedAt: new Date()
              }
            }
            await agent.save()
            
            // RAG failure is non-critical - document is still saved to MongoDB
          }

          // Send completion
          await eventStream.push(JSON.stringify({
            type: 'complete',
            phase: 'completed',
            message: `Website content added successfully (${websiteContent.totalPages} pages crawled)`,
            currentPage: websiteContent.totalPages,
            totalPages: websiteContent.totalPages,
            percentage: 100,
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
                pageUrls: websiteContent.pages.map((page: any) => ({ url: page.url, title: page.title }))
              },
              agent: {
                _id: agent._id,
                name: agent.name,
                contextDocumentsCount: agent.contextDocuments.length
              },
              rag: ragInfo
            }
          }))

          // Close the stream
          eventStream.close()
        } catch (error: any) {
          console.error('Website crawl error during streaming:', error)
          
          // Send sanitized error via SSE (don't expose internal details)
          const sanitizedMessage = sanitizeErrorMessage(error)
          await eventStream.push(JSON.stringify({
            type: 'error',
            phase: 'error',
            message: sanitizedMessage,
            error: 'Website crawling failed'
          }))
          
          eventStream.close()
        }
      }

    // Start the crawling process in the background
    handleCrawling()

    // Return the event stream
    return eventStream.send()

  } catch (error: any) {
    console.error('Add website context error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error with sanitized message
    throw createError({
      statusCode: 500,
      statusMessage: sanitizeErrorMessage(error) || 'Failed to add website context'
    })
  }
}) 