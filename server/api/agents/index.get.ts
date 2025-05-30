import { connectDB } from '~/server/utils/db'
import { requireAuth } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default defineEventHandler(async (event) => {
  try {
    // Connect to database
    await connectDB()

    // Require authentication
    const user = await requireAuth(event)

    // Build query based on user role
    let query: any = {}
    if (user.role !== 'admin') {
      // Non-admin users can only see agents they have access to
      query._id = { $in: user.agentAccess || [] }
    }

    // Fetch agents
    const agents = await Agent.find(query)
      .populate('createdBy', 'name email')
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