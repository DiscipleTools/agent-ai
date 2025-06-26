import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
import { ragService } from '~/server/services/ragService'
import mongoose from 'mongoose'

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

    // Get agent ID and document ID from params
    const agentId = getRouterParam(event, 'id')
    const docId = getRouterParam(event, 'docId')
    
    if (!agentId || !docId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent ID and Document ID are required'
      })
    }

    // Get request body
    const body = await readBody(event)
    const { content, filename, refreshUrl } = body

    // Validate input
    if (!content && !filename && !refreshUrl) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one field (content, filename, or refreshUrl) is required'
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

    // Find the context document
    const docIndex = agent.contextDocuments.findIndex((doc: any) => doc._id.toString() === docId)
    if (docIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Context document not found'
      })
    }

    const contextDoc = agent.contextDocuments[docIndex]
    let updatedContent = contextDoc.content
    let updatedFilename = contextDoc.filename

    // Check if this is a streaming request for website re-crawl
    const isStreaming = refreshUrl && contextDoc.type === 'website' && contextDoc.url && 
                       getQuery(event).stream === 'true'

    // Handle URL refresh
    if (refreshUrl && contextDoc.type === 'url' && contextDoc.url) {
      try {
        console.log(`Refreshing URL content for: ${contextDoc.url}`)
        const scrapedContent = await webScrapingService.scrapeUrl(contextDoc.url)
        updatedContent = scrapedContent.content
        updatedFilename = scrapedContent.title || contextDoc.filename
        
        console.log(`URL content refreshed: ${scrapedContent.content.length} characters`)
        
        // Update the document first
        agent.contextDocuments[docIndex] = {
          ...contextDoc.toObject(),
          type: contextDoc.type,
          content: updatedContent,
          filename: updatedFilename,
          uploadedAt: new Date()
        }
        await agent.save()
        
        const updatedDoc = agent.contextDocuments[docIndex]
        const documentId = updatedDoc._id?.toString()
        
        // Reprocess document for RAG (vector embeddings)
        let ragInfo = null
        try {
          if (documentId) {
            console.log(`🔄 Reprocessing URL document for RAG: ${documentId}`)
            
            // First, delete existing chunks for this document
            await ragService.deleteDocumentChunks(agentId, documentId)
            console.log(`🗑️  Deleted old RAG chunks for URL document`)
            
            // Then process the new content
            const ragResult = await ragService.processDocument(
              agentId,
              documentId,
              updatedContent,
              {
                type: 'url',
                title: updatedDoc.filename || 'URL Document',
                source: updatedDoc.url || contextDoc.url
              }
            )
            ragInfo = {
              chunksCreated: ragResult.chunksCreated,
              collectionName: ragResult.collectionName
            }
            
            // Update document metadata with RAG status
            agent.contextDocuments[docIndex].metadata = {
              ...agent.contextDocuments[docIndex].metadata,
              rag: {
                processed: true,
                chunksCreated: ragResult.chunksCreated,
                processedAt: new Date()
              }
            }
            await agent.save()
            
            console.log(`✅ RAG reprocessing completed: ${ragResult.chunksCreated} chunks created for URL`)
          }
        } catch (ragError: any) {
          console.error('RAG reprocessing failed (non-critical):', ragError)
          
          // Update document metadata to indicate RAG processing failed
          agent.contextDocuments[docIndex].metadata = {
            ...agent.contextDocuments[docIndex].metadata,
            rag: {
              processed: false,
              error: ragError.message || 'RAG reprocessing failed',
              attemptedAt: new Date()
            }
          }
          await agent.save()
        }
        
        return {
          success: true,
          message: 'URL content refreshed successfully',
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
            },
            rag: ragInfo
          }
        }
        
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

        // Handle streaming re-crawl
        if (isStreaming) {
          const eventStream = createEventStream(event)

          // Handle the re-crawling in the background
          const handleReCrawling = async () => {
            try {
              // Send initial progress
              await eventStream.push(JSON.stringify({
                type: 'progress',
                phase: 'starting',
                message: 'Starting website re-crawl...',
                currentPage: 0,
                totalPages: originalOptions.maxPages || 10,
                percentage: 0
              }))

              // Re-crawl the website with progress callbacks
              console.log(`Starting website re-crawl for agent ${agent.name}: ${contextDoc.url}`)
              
              const websiteContent = await webScrapingService.crawlWebsiteWithProgress(contextDoc.url, originalOptions, async (progress: any) => {
                await eventStream.push(JSON.stringify({
                  type: 'progress',
                  phase: 'crawling',
                  message: progress.message,
                  currentPage: progress.currentPage,
                  totalPages: progress.estimatedTotal || originalOptions.maxPages || 10,
                  percentage: Math.round((progress.currentPage / (progress.estimatedTotal || originalOptions.maxPages || 10)) * 100),
                  currentUrl: progress.currentUrl
                }))
              })

              // Send processing phase
              await eventStream.push(JSON.stringify({
                type: 'progress',
                phase: 'processing',
                message: 'Processing re-crawled content...',
                currentPage: websiteContent.totalPages,
                totalPages: websiteContent.totalPages,
                percentage: 95
              }))

              // Combine all page content into a single document (same format as original)
              let combinedContent = `${websiteContent.summary}\n\n`
              combinedContent += `=== WEBSITE CONTENT ===\n\n`
              
              websiteContent.pages.forEach((page: any, index: number) => {
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
                pageUrls: websiteContent.pages.map((page: any) => page.url),
                lastCrawled: new Date()
              }
              
              // Update the document with new metadata
              agent.contextDocuments[docIndex] = {
                ...contextDoc.toObject(),
                type: contextDoc.type, // Explicitly preserve the type field
                content: updatedContent,
                filename: updatedFilename,
                uploadedAt: new Date(),
                metadata: updatedMetadata
              }
              
              await agent.save()
              
              console.log(`Website re-crawled: ${websiteContent.totalPages} pages, ${websiteContent.totalContentLength} characters`)
              
              const updatedDoc = agent.contextDocuments[docIndex]
              const documentId = updatedDoc._id?.toString()

              // Send RAG processing phase
              await eventStream.push(JSON.stringify({
                type: 'progress',
                phase: 'rag',
                message: 'Creating vector embeddings...',
                currentPage: websiteContent.totalPages,
                totalPages: websiteContent.totalPages,
                percentage: 98
              }))
              
              // Reprocess document for RAG (vector embeddings)
              let ragInfo = null
              try {
                if (documentId) {
                  console.log(`🔄 Reprocessing document for RAG: ${documentId}`)
                  
                  // First, delete existing chunks for this document
                  await ragService.deleteDocumentChunks(agentId, documentId)
                  
                  // Then process the new content
                  const ragResult = await ragService.processDocument(
                    agentId,
                    documentId,
                    updatedContent,
                    {
                      type: 'website',
                      title: updatedDoc.filename || 'Website',
                      source: updatedDoc.url || websiteContent.baseUrl
                    }
                  )
                  ragInfo = {
                    chunksCreated: ragResult.chunksCreated,
                    collectionName: ragResult.collectionName
                  }
                  
                  // Update document metadata with RAG status
                  agent.contextDocuments[docIndex].metadata = {
                    ...agent.contextDocuments[docIndex].metadata,
                    rag: {
                      processed: true,
                      chunksCreated: ragResult.chunksCreated,
                      processedAt: new Date()
                    }
                  }
                  await agent.save()
                  
                  console.log(`✅ RAG reprocessing completed: ${ragResult.chunksCreated} chunks created`)
                }
              } catch (ragError: any) {
                console.error('RAG reprocessing failed (non-critical):', ragError)
                
                // Update document metadata to indicate RAG processing failed
                agent.contextDocuments[docIndex].metadata = {
                  ...agent.contextDocuments[docIndex].metadata,
                  rag: {
                    processed: false,
                    error: ragError.message || 'RAG reprocessing failed',
                    attemptedAt: new Date()
                  }
                }
                await agent.save()
                
                // RAG failure is non-critical - document is still updated in MongoDB
              }

              // Send completion
              await eventStream.push(JSON.stringify({
                type: 'complete',
                phase: 'complete',
                message: `Website re-crawled successfully (${websiteContent.totalPages} pages)`,
                percentage: 100,
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
                  },
                  rag: ragInfo
                }
              }))

              eventStream.close()

            } catch (error: any) {
              console.error('Website re-crawl error during streaming:', error)
              
              // Send error via SSE
              await eventStream.push(JSON.stringify({
                type: 'error',
                phase: 'error',
                message: error.message || 'Failed to re-crawl website',
                error: error.statusMessage || error.message
              }))
              
              eventStream.close()
            }
          }

          // Start the re-crawling process in the background
          handleReCrawling()

          // Return the event stream
          return eventStream.send()
        }

        // Non-streaming mode (original behavior for backward compatibility)
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
          ...contextDoc.toObject(),
          type: contextDoc.type, // Explicitly preserve the type field
          content: updatedContent,
          filename: updatedFilename,
          uploadedAt: new Date(),
          metadata: updatedMetadata
        }
        
        await agent.save()
        
        console.log(`Website re-crawled: ${websiteContent.totalPages} pages, ${websiteContent.totalContentLength} characters`)
        
        const updatedDoc = agent.contextDocuments[docIndex]
        const documentId = updatedDoc._id?.toString()
        
        // Reprocess document for RAG (vector embeddings)
        let ragInfo = null
        try {
          if (documentId) {
            console.log(`🔄 Reprocessing document for RAG: ${documentId}`)
            
            // First, delete existing chunks for this document
            await ragService.deleteDocumentChunks(agentId, documentId)
            
            // Then process the new content
            const ragResult = await ragService.processDocument(
              agentId,
              documentId,
              updatedContent,
              {
                type: 'website',
                title: updatedDoc.filename || 'Website',
                source: updatedDoc.url || websiteContent.baseUrl
              }
            )
            ragInfo = {
              chunksCreated: ragResult.chunksCreated,
              collectionName: ragResult.collectionName
            }
            
            // Update document metadata with RAG status
            agent.contextDocuments[docIndex].metadata = {
              ...agent.contextDocuments[docIndex].metadata,
              rag: {
                processed: true,
                chunksCreated: ragResult.chunksCreated,
                processedAt: new Date()
              }
            }
            await agent.save()
            
            console.log(`✅ RAG reprocessing completed: ${ragResult.chunksCreated} chunks created`)
          }
        } catch (ragError: any) {
          console.error('RAG reprocessing failed (non-critical):', ragError)
          
          // Update document metadata to indicate RAG processing failed
          agent.contextDocuments[docIndex].metadata = {
            ...agent.contextDocuments[docIndex].metadata,
            rag: {
              processed: false,
              error: ragError.message || 'RAG reprocessing failed',
              attemptedAt: new Date()
            }
          }
          await agent.save()
          
          // RAG failure is non-critical - document is still updated in MongoDB
        }
        
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
            },
            rag: ragInfo
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
      ...contextDoc.toObject(),
      type: contextDoc.type, // Explicitly preserve the type field
      content: updatedContent,
      filename: updatedFilename,
      uploadedAt: refreshUrl ? new Date() : contextDoc.uploadedAt // Update timestamp only if refreshed
    }

    await agent.save()

    const updatedDoc = agent.contextDocuments[docIndex]
    const documentId = updatedDoc._id?.toString()

    console.log(`Updated context document for agent ${agent.name}: ${updatedDoc.type} - ${updatedDoc.filename || updatedDoc.url}`)

    // Reprocess document for RAG if content was updated
    let ragInfo = null
    if (content !== undefined || filename !== undefined) {
      try {
        if (documentId) {
          console.log(`🔄 Reprocessing document for RAG after manual update: ${documentId}`)
          
          // First, delete existing chunks for this document
          await ragService.deleteDocumentChunks(agentId, documentId)
          
          // Then process the updated content
          const ragResult = await ragService.processDocument(
            agentId,
            documentId,
            updatedContent,
            {
              type: updatedDoc.type as 'file' | 'url' | 'website',
              title: updatedDoc.filename || 'Document',
              source: updatedDoc.url || updatedDoc.filename || 'Manual update'
            }
          )
          ragInfo = {
            chunksCreated: ragResult.chunksCreated,
            collectionName: ragResult.collectionName
          }
          
          // Update document metadata with RAG status
          agent.contextDocuments[docIndex].metadata = {
            ...agent.contextDocuments[docIndex].metadata,
            rag: {
              processed: true,
              chunksCreated: ragResult.chunksCreated,
              processedAt: new Date()
            }
          }
          await agent.save()
          
          console.log(`✅ RAG reprocessing completed: ${ragResult.chunksCreated} chunks created`)
        }
      } catch (ragError: any) {
        console.error('RAG reprocessing failed (non-critical):', ragError)
        
        // Update document metadata to indicate RAG processing failed
        agent.contextDocuments[docIndex].metadata = {
          ...agent.contextDocuments[docIndex].metadata,
          rag: {
            processed: false,
            error: ragError.message || 'RAG reprocessing failed',
            attemptedAt: new Date()
          }
        }
        await agent.save()
        
        // RAG failure is non-critical - document is still updated in MongoDB
      }
    }

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
        },
        rag: ragInfo
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