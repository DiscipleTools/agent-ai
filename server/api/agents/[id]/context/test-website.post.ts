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

    // Find the agent (to verify access)
    const agent = await Agent.findById(agentId).select('name')
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

    // Validate crawl options
    const crawlOptions = {
      maxPages: Math.min(options.maxPages || 200, 200), // Cap at 200 pages
      maxDepth: Math.min(options.maxDepth || 2, 3), // Cap at 3 levels deep
      sameDomainOnly: options.sameDomainOnly !== false, // Default to true
      includePatterns: Array.isArray(options.includePatterns) ? options.includePatterns : [],
      excludePatterns: Array.isArray(options.excludePatterns) ? options.excludePatterns : []
    }

    // Test website accessibility and crawlability
    const testResult = await webScrapingService.testWebsite(url, crawlOptions)

    if (!testResult.accessible) {
      return {
        success: false,
        message: 'Website is not accessible for crawling',
        data: {
          url,
          accessible: false,
          error: testResult.error,
          robotsAllowed: testResult.robotsAllowed,
          suggestions: [
            'Check if the URL is correct and publicly accessible',
            'Ensure the website allows automated access',
            'Try accessing the URL manually in a browser',
            'Check if robots.txt allows crawling'
          ]
        }
      }
    }

    return {
      success: true,
      message: 'Website is accessible and ready to be crawled',
      data: {
        url,
        accessible: true,
        robotsAllowed: testResult.robotsAllowed,
        estimatedPages: testResult.estimatedPages,
        sampleLinks: testResult.sampleLinks,
        crawlOptions,
        estimatedProcessingTime: testResult.estimatedPages && testResult.estimatedPages > 5 
          ? 'May take several minutes to process' 
          : 'Should process quickly'
      }
    }

  } catch (error: any) {
    console.error('Test website error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to test website'
    })
  }
}) 