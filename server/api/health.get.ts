// Import RAG service to trigger initialization on first server request
import { ragService } from '~/server/services/ragService'

export default defineEventHandler(async (event) => {
  // The import above will trigger RAG service initialization including embedding model download
  
  return {
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Agent AI Server is running'
  }
}) 