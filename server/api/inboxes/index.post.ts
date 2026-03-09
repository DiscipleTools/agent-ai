// Inboxes cannot be created manually - they are auto-synced from Chatwoot
export default defineEventHandler(async (event) => {
  throw createError({
    statusCode: 405,
    statusMessage: 'Inboxes cannot be created manually. Create inboxes in Chatwoot and they will be automatically synced to Agent AI.'
  })
})