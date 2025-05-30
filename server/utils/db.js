import mongoose from 'mongoose'

let isConnected = false

export async function connectDB() {
  if (isConnected) return

  try {
    const config = useRuntimeConfig()
    const mongoUri = config.mongodbUri || 'mongodb://localhost:27017/agent-ai-server'
    
    await mongoose.connect(mongoUri)
    
    isConnected = true
    console.log('✅ MongoDB Connected:', mongoose.connection.host)
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message)
    throw error
  }
} 