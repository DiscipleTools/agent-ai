/**
 * @description Set the default AI connection and model.
 * @endpoint PUT /api/settings/default-ai
 */
import settingsService from '~/server/services/settingsService'
import { chatwootAuthMiddleware } from '~/server/utils/auth'
import { sanitizeObjectId, sanitizeModelId } from '~/utils/sanitize'

export default chatwootAuthMiddleware.superAdmin(async (event, checker) => {
  try {
    // Get user from checker
    const user = checker.user
    const body = await readBody(event)

    const connectionId = sanitizeObjectId(body.connectionId)
    const modelId = sanitizeModelId(body.modelId)

    // Improved validation with specific error messages
    if (!body.connectionId || typeof body.connectionId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Connection ID is required and must be a valid string'
      })
    }

    if (!connectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Connection ID must be a valid 24-character ObjectId'
      })
    }

    if (!modelId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model ID is required'
      })
    }

    // Get current settings
    const settings = await settingsService.getAllSettings()
    if (!settings) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to load settings'
      })
    }

    // Verify connection exists and is active
    const connection = settings.aiConnections?.find(
      (conn: any) => conn._id.toString() === connectionId && conn.isActive
    )

    if (!connection) {
      throw createError({
        statusCode: 404,
        statusMessage: 'AI connection not found or inactive'
      })
    }

    // Verify model exists and is enabled
    const model = connection.availableModels?.find(
      (m: any) => m.id === modelId && m.enabled
    )

    if (!model) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Model not found or disabled'
      })
    }

    // Update default connection
    settings.defaultConnection = {
      connectionId,
      modelId
    }

    // Update settings
    await settingsService.updateSettings({
      defaultConnection: settings.defaultConnection
    }, user._id)

    return {
      success: true,
      data: {
        connectionId,
        modelId,
        connectionName: connection.name,
        modelName: model.name
      },
      message: 'Default AI connection updated successfully'
    }
  } catch (error: any) {
    console.error('Failed to update default AI connection:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to update default AI connection'
    })
  }
}) 