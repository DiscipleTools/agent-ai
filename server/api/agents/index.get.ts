/**
 * GET /api/agents
 * 
 * Retrieves a list of agents. Admins can see all agents,
 * while non-admin users can only see agents they have access to.
 * 
 */

import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default authMiddleware.auth(async (event, checker) => {
  try {
    // Connect to database
    await connectDB()

    // Get user from checker
    const user = checker.user

    // Build query based on user role
    let query: any = {}
    if (user.role !== 'admin') {
      // Non-admin users can only see agents they have access to
      query._id = { $in: user.agentAccess || [] }
    }

    // Fetch agents with only necessary fields for listing
    const agents = await Agent.find(query)
      .select('name description isActive createdAt createdBy')
      .populate('createdBy', 'name')
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