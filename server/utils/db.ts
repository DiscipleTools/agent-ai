import mongoose from 'mongoose'
import { ConnectionStringValidator } from './connectionValidator.js'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  hasWarnings: boolean
}

let isConnected = false

export async function connectDB(): Promise<void> {
  if (isConnected) return

  try {
    const config = useRuntimeConfig()
    const mongoUri = config.mongodbUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    const environment = config.NODE_ENV || process.env.NODE_ENV || 'development'
    
    // Validate connection string before attempting connection
    console.log('🔍 Validating MongoDB connection string...')
    const validation = ConnectionStringValidator.validate(mongoUri, environment) as ValidationResult
    
    // Log validation results
    if (!validation.isValid) {
      console.error('❌ MongoDB Connection String Validation Failed:')
      validation.errors.forEach((error: string) => console.error(`   • ${error}`))
      throw new Error(`Invalid MongoDB connection string: ${validation.errors.join(', ')}`)
    }
    
    if (validation.hasWarnings) {
      console.warn('⚠️  MongoDB Connection String Warnings:')
      validation.warnings.forEach((warning: string) => console.warn(`   • ${warning}`))
    }
    
    if (validation.isValid && !validation.hasWarnings) {
      console.log('✅ MongoDB connection string validation passed')
    }
    
    await mongoose.connect(mongoUri)
    
    isConnected = true
    console.log('✅ MongoDB Connected:', mongoose.connection.host)
    
    // Log additional connection info for debugging
    if (environment === 'development') {
      console.log(`🔗 Connection details: ${mongoose.connection.name} (${environment})`)
    }
    
  } catch (error: any) {
    console.error('❌ MongoDB Connection Error:', error.message)
    throw error
  }
} 