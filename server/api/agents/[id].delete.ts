/**
 * DELETE /api/agents/[id]
 * 
 * Deletes an agent by ID. This endpoint requires authentication and proper authorization.
 * The user must either be an admin or have explicit access to the specified agent.
 * 
 * Security:
 * - AgentId is validated and sanitized in the auth middleware
 * - Authorization is enforced through agentAccess middleware
 * - Uses safe MongoDB operations (findById, findByIdAndDelete)
 * - Proper error handling with appropriate HTTP status codes
 * 
 * @param {string} id - Agent ID (validated as MongoDB ObjectId)
 * @returns {Object} Success response with message
 * @throws {404} Agent not found
 * @throws {403} Access denied (insufficient permissions)
 * @throws {401} Unauthorized (invalid/missing token)
 * @throws {500} Server error
 */

import { connectDB } from '~/server/utils/db'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'

export default chatwootAuthMiddleware.agentAccess('delete')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Find agent
    const agent = await Agent.findById(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Delete agent
    await Agent.findByIdAndDelete(agentId)

    return {
      success: true,
      message: 'Agent deleted successfully'
    }
  } catch (error: any) {
    console.error('Delete agent error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to delete agent'
    })
  }
}) 