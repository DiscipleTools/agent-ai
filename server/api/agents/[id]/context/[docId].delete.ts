/**
 * DELETE /api/agents/[id]/context/[docId]
 * 
 * Deletes a specific context document from an agent's context documents array.
 * Requires authentication and proper agent access permissions.
 * Returns success confirmation with deleted document details.
 */
import { connectDB } from '~/server/utils/db'
import { authMiddleware } from '~/server/utils/auth'
import Agent from '~/server/models/Agent'
import mongoose from 'mongoose'

export default authMiddleware.agentAccess('write')(async (event, checker, agentId) => {
  try {
    // Connect to database
    await connectDB()

    // Get document ID from params (agentId already validated by middleware)
    const docId = getRouterParam(event, 'docId')
    if (!docId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Document ID is required'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid document ID format'
      })
    }

    // Find the agent (permission already verified by middleware)
    const agent = await Agent.findById(agentId)
    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agent not found'
      })
    }

    // Find the context document
    const docIndex = agent.contextDocuments.findIndex((doc: any) => doc._id?.toString() === docId)
    if (docIndex === -1) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Context document not found'
      })
    }

    // Get document info before deletion for logging
    const deletedDoc = agent.contextDocuments[docIndex]
    const docInfo = {
      type: deletedDoc.type,
      filename: deletedDoc.filename,
      url: deletedDoc.url,
      contentLength: deletedDoc.content?.length || 0
    }

    // Remove the document
    agent.contextDocuments.splice(docIndex, 1)
    await agent.save()

    console.log(`Deleted context document from agent ${agent.name}: ${docInfo.type} - ${docInfo.filename || docInfo.url}`)

    return {
      success: true,
      message: 'Context document deleted successfully',
      data: {
        deletedDocument: {
          _id: docId,
          type: docInfo.type,
          filename: docInfo.filename,
          url: docInfo.url,
          contentLength: docInfo.contentLength
        }
      }
    }

  } catch (error: any) {
    console.error('Delete context document error:', error)

    // If it's already a createError, re-throw it
    if (error.statusCode) {
      throw error
    }

    // Otherwise, create a generic error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to delete context document'
    })
  }
}) 