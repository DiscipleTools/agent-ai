// Server plugin to ensure all Mongoose models are loaded
// This ensures models are registered before any populate operations

export default async function () {
  if (process.server) {
    // Import all models to ensure they're registered with Mongoose
    await import('~/server/models/Agent')
    await import('~/server/models/Inbox')
    await import('~/server/models/Settings')
  }
}