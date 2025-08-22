/**
 * Agent Update API Endpoint
 * 
 * PUT /api/agents/[id]
 * 
 * Updates an existing agent's properties including name, description, prompt, 
 * active status, and AI connection settings. Validates user permissions through
 * middleware and sanitizes all user inputs to prevent XSS and injection attacks.
 * 
 * Security features:
 * - Agent access control via authMiddleware.agentAccess('write')
 * - Input sanitization for all user-provided fields
 * - ObjectId validation for connection references
 * - Bounded input lengths to prevent DoS attacks
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import mongoose from 'mongoose'
import { sanitizeText, sanitizeContent, sanitizeObjectId, sanitizeNumber } from '~/utils/sanitize'

export default chatwootAuthMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get request body
    const body = await readBody(event)

    // Validate and sanitize basic inputs
    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body'
      })
    }

    // Find agent
    const agent = await Agent.findById(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Sanitize and validate individual fields
    if (body.name !== undefined) {
      const sanitizedName = sanitizeText(body.name)
      if (!sanitizedName || sanitizedName.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Agent name cannot be empty'
        })
      }
      if (sanitizedName.length > 100) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Agent name must be 100 characters or less'
        })
      }
      agent.name = sanitizedName
    }

    if (body.description !== undefined) {
      const sanitizedDescription = sanitizeContent(body.description)
      if (sanitizedDescription.length > 1000) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Agent description must be 1000 characters or less'
        })
      }
      agent.description = sanitizedDescription
    }

    if (body.prompt !== undefined) {
      const sanitizedPrompt = sanitizeContent(body.prompt)
      if (sanitizedPrompt.length > 10000) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Agent prompt must be 10000 characters or less'
        })
      }
      agent.prompt = sanitizedPrompt
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        throw createError({
          statusCode: 400,
          statusMessage: 'isActive must be a boolean value'
        })
      }
      agent.isActive = body.isActive
    }
    
    // Update settings with proper sanitization
    if (body.settings && typeof body.settings === 'object') {
      const currentSettings = (agent as any).settings || {}
      
      // Sanitize and validate individual settings
      if (body.settings.connectionId !== undefined) {
        if (body.settings.connectionId === null || body.settings.connectionId === '') {
          // Allow clearing the connection
          currentSettings.connectionId = null
        } else {
          const sanitizedConnectionId = sanitizeObjectId(body.settings.connectionId)
          if (!sanitizedConnectionId) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Invalid connection ID format'
            })
          }
          if (!mongoose.Types.ObjectId.isValid(sanitizedConnectionId)) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Invalid connection ID format'
            })
          }
          currentSettings.connectionId = sanitizedConnectionId
        }
      }

      // Sanitize other numeric settings
      if (body.settings.temperature !== undefined) {
        const sanitizedTemp = sanitizeNumber(body.settings.temperature)
        if (sanitizedTemp < 0 || sanitizedTemp > 2) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Temperature must be between 0 and 2'
          })
        }
        currentSettings.temperature = sanitizedTemp
      }

      if (body.settings.maxTokens !== undefined) {
        const sanitizedMaxTokens = sanitizeNumber(body.settings.maxTokens)
        if (sanitizedMaxTokens < 1 || sanitizedMaxTokens > 100000) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Max tokens must be between 1 and 100000'
          })
        }
        currentSettings.maxTokens = sanitizedMaxTokens
      }

      if (body.settings.responseDelay !== undefined) {
        const sanitizedDelay = sanitizeNumber(body.settings.responseDelay)
        if (sanitizedDelay < 0 || sanitizedDelay > 60000) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Response delay must be between 0 and 60000 milliseconds'
          })
        }
        currentSettings.responseDelay = sanitizedDelay
      }

      // Sanitize text-based settings
      if (body.settings.modelId !== undefined) {
        const sanitizedModelId = sanitizeText(body.settings.modelId)
        if (sanitizedModelId && sanitizedModelId.length > 100) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Model ID must be 100 characters or less'
          })
        }
        currentSettings.modelId = sanitizedModelId || null
      }

      if (body.settings.chatwootApiKey !== undefined) {
        const sanitizedApiKey = sanitizeText(body.settings.chatwootApiKey)
        if (sanitizedApiKey && sanitizedApiKey.length > 200) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Chatwoot API key must be 200 characters or less'
          })
        }
        currentSettings.chatwootApiKey = sanitizedApiKey || null
      }
      
      ;(agent as any).settings = currentSettings
    }

    // Save agent
    await agent.save()

    // Populate createdBy field for response
    await agent.populate('createdBy', 'name email')

    return {
      success: true,
      data: agent
    }
  } catch (error: any) {
    console.error('Update agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to update agent'
    })
  }
}) 