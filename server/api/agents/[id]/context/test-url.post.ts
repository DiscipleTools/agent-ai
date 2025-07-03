/**
 * API Endpoint: POST /api/agents/[id]/context/test-url
 * 
 * Tests if a URL is accessible and scrapes basic metadata before adding it as context.
 * This endpoint verifies URL accessibility, attempts content scraping, and returns
 * preview information including title, content length, and a content preview.
 * Used to validate URLs before they are added to an agent's context documents.
 * 
 * Authentication: Required
 * Authorization: Admin or user with agent access
 */
import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import { validateUrlOrThrow } from '~/server/utils/urlValidator'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
import mongoose from 'mongoose'

export default authMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { url } = body

    if (!url || typeof url !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'URL is required and must be a string'
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

    // Find the agent (permission already verified by middleware)
    const agent = await Agent.findById(agentId).select('name')
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Test URL accessibility
    const testResult = await webScrapingService.testUrl(url)

    if (!testResult.accessible) {
      return {
        success: false,
        message: 'URL is not accessible',
        data: {
          url,
          accessible: false,
          error: testResult.error
        }
      }
    }

    // Return success response with actual content scraping
    
    let contentPreview = 'Preview not available'
    let contentLength = 0
    let title = 'Title not available'

    // Attempt content scraping with complete error isolation
    try {
      
      // Use setTimeout to completely isolate the scraping process
      const scrapingResult = await Promise.race([
        webScrapingService.scrapeUrl(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Scraping timeout')), 8000))
      ]) as any
      
      if (scrapingResult && typeof scrapingResult === 'object') {
        contentPreview = (scrapingResult as any).content ? 
          (scrapingResult as any).content.substring(0, 500) + ((scrapingResult as any).content.length > 500 ? '...' : '') :
          'Content not available'
        contentLength = (scrapingResult as any).content?.length || 0
        title = (scrapingResult as any).title || 'Title not available'
      }
    } catch (error: any) {
      console.warn('Content scraping failed, using defaults:', error.message)
      // Keep default values - don't let scraping errors affect the response
    }

    const response = {
      success: true,
      message: 'URL is accessible and ready to be added',
      data: {
        url,
        accessible: true,
        contentType: testResult.contentType,
        title,
        contentLength,
        contentPreview,
        estimatedProcessingTime: contentLength > 10000 ? 'May take a few seconds to process' : 'Quick to process'
      }
    }
    return response

  } catch (error: any) {
    console.error('Test URL error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to test URL'
    })
  }
}) 