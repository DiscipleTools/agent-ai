/**
 * GET /api/agents
 * 
 * Retrieves a list of agents based on Chatwoot account administration.
 * Super admins can see all agents, while other users can only see agents
 * that belong to Chatwoot accounts where they are administrators.
 * 
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware, getAgentAccessQuery } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default chatwootAuthMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get user from checker
    const user = checker.user

    // Build query based on user's Chatwoot account administration
    const query = getAgentAccessQuery(user)

    // Fetch agents with only necessary fields for listing
    const agents = await Agent.find(query)
      .select('name description isActive createdAt createdBy inboxes')
      .sort({ createdAt: -1 })

    return {
      success: true,
      data: agents
    }
  } catch (error: any) {
    console.error('Get agents error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch agents'
    })
  }
}) 