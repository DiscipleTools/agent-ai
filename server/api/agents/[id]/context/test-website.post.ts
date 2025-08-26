/**
 * API endpoint to test website accessibility and crawlability before adding it to an agent's context.
 * Validates the URL, checks if the website allows crawling, and returns metadata about the site
 * including estimated pages and sample links. This helps users understand what will be crawled
 * before actually performing the full website ingestion.
 */
import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import { validateUrlOrThrow } from '~/server/utils/urlValidator'
import Agent from '~/server/models/Agent'
import webScrapingService from '~/server/services/webScrapingService'
import mongoose from 'mongoose'

// Using the new centralized permission system
export default chatwootAuthMiddleware.agentAccess('read')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)
    const { url, options = {} } = body

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

    // Find the agent (we know user has access from middleware)
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Helper function to validate string patterns
    const validateStringPattern = (pattern: string): boolean => {
      // Limit pattern length for security
      if (pattern.length > 200) {
        return false
      }
      // Ensure it's a valid string (no control characters)
      if (/[\x00-\x1f\x7f]/.test(pattern)) {
        return false
      }
      return true
    }

    // Validate and sanitize crawl options
    const includePatterns = Array.isArray(options.includePatterns) ? options.includePatterns : []
    const excludePatterns = Array.isArray(options.excludePatterns) ? options.excludePatterns : []

    // Validate string patterns
    for (const pattern of includePatterns) {
      if (typeof pattern !== 'string' || !validateStringPattern(pattern)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid include pattern: must be valid string under 200 characters with no control characters'
        })
      }
    }

    for (const pattern of excludePatterns) {
      if (typeof pattern !== 'string' || !validateStringPattern(pattern)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid exclude pattern: must be valid string under 200 characters with no control characters'
        })
      }
    }

    // Validate crawl options
    const crawlOptions = {
      maxPages: Math.min(options.maxPages || 200, 200), // Cap at 200 pages
      maxDepth: Math.min(options.maxDepth || 2, 3), // Cap at 3 levels deep
      sameDomainOnly: options.sameDomainOnly !== false, // Default to true
      includePatterns,
      excludePatterns
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