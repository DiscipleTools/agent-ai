export default defineEventHandler(async (event) => {
  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Agent AI Server is running'
  }
}) 