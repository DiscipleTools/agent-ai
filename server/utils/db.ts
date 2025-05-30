import mongoose from 'mongoose'

let isConnected = false

export async function connectDB() {
  if (isConnected) return

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    
    await mongoose.connect(mongoUri)
    
    isConnected = true
    console.log('✅ MongoDB Connected:', mongoose.connection.host)
  } catch (error: any) {
    console.error('❌ MongoDB Connection Error:', error.message)
    throw error
  }
} 