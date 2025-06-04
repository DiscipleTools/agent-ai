import settingsService from '~/server/services/settingsService'
import { requireAuth, requireAdmin } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication and admin role
    await requireAuth(event)
    await requireAdmin(event)

    const user = event.context.user
    const body = await readBody(event)

    if (!body.connectionId || !body.modelId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Connection ID and model ID are required'
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
      (conn: any) => conn._id.toString() === body.connectionId && conn.isActive
    )

    if (!connection) {
      throw createError({
        statusCode: 404,
        statusMessage: 'AI connection not found or inactive'
      })
    }

    // Verify model exists and is enabled
    const model = connection.availableModels?.find(
      (m: any) => m.id === body.modelId && m.enabled
    )

    if (!model) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Model not found or disabled'
      })
    }

    // Update default connection
    settings.defaultConnection = {
      connectionId: body.connectionId,
      modelId: body.modelId
    }

    // Update settings
    await settingsService.updateSettings({
      defaultConnection: settings.defaultConnection
    }, user._id)

    return {
      success: true,
      data: {
        connectionId: body.connectionId,
        modelId: body.modelId,
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