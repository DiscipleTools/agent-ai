import mongoose from 'mongoose'

let isConnected = false

export default async function () {
  if (isConnected) return

  try {
    const config = useRuntimeConfig()
    const mongoUri = config.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    
    isConnected = true
    console.log('✅ MongoDB Connected:', mongoose.connection.host)
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message)
    throw error
  }
} 