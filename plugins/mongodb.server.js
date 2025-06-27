import mongoose from 'mongoose'
import { ConnectionStringValidator } from '~/server/utils/connectionValidator.js'

let isConnected = false

export default async function () {
  if (isConnected) return

  try {
    const config = useRuntimeConfig()
    const mongoUri = config.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    const environment = process.env.NODE_ENV || 'development'
    
    // Validate connection string before attempting connection
    console.log('🔍 Validating MongoDB connection string...')
    const validation = ConnectionStringValidator.validate(mongoUri, environment)
    
    // Log validation results
    if (!validation.isValid) {
      console.error('❌ MongoDB Connection String Validation Failed:')
      validation.errors.forEach(error => console.error(`   • ${error}`))
      throw new Error(`Invalid MongoDB connection string: ${validation.errors.join(', ')}`)
    }
    
    if (validation.hasWarnings) {
      console.warn('⚠️  MongoDB Connection String Warnings:')
      validation.warnings.forEach(warning => console.warn(`   • ${warning}`))
    }
    
    if (validation.isValid && !validation.hasWarnings) {
      console.log('✅ MongoDB connection string validation passed')
    }
    
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