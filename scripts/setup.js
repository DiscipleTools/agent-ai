#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

console.log('🚀 Agent AI Server Setup\n')

// Check if .env file exists
const envPath = '.env'
const envExamplePath = 'env.example'

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...')
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log('✅ .env file created from template')
  } else {
    console.log('⚠️  env.example not found, creating basic .env file')
    const basicEnv = `# Database
MONGODB_URI=mongodb://localhost:27017/agent-ai-server

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Application
APP_NAME=Agent AI Server
NODE_ENV=development
`
    fs.writeFileSync(envPath, basicEnv)
    console.log('✅ Basic .env file created')
  }
} else {
  console.log('✅ .env file already exists')
}

// Check MongoDB connection
console.log('\n🔍 Checking MongoDB connection...')
try {
  // Try to connect to MongoDB
  const { connectDB } = await import('./server/utils/db.js')
  await connectDB()
  console.log('✅ MongoDB connection successful')
} catch (error) {
  console.log('❌ MongoDB connection failed:', error.message)
  console.log('💡 Make sure MongoDB is running and the MONGODB_URI in .env is correct')
}

// Check if admin user exists
console.log('\n👤 Checking admin user...')
try {
  const { default: User } = await import('./server/models/User.js')
  const adminUser = await User.findOne({ role: 'admin' })
  
  if (adminUser) {
    console.log('✅ Admin user already exists:', adminUser.email)
  } else {
    console.log('📝 Creating admin user...')
    execSync('npm run create-admin', { stdio: 'inherit' })
  }
} catch (error) {
  console.log('⚠️  Could not check admin user:', error.message)
  console.log('💡 You can create an admin user manually with: npm run create-admin')
}

console.log('\n🎉 Setup complete!')
console.log('\n📋 Next steps:')
console.log('1. Review and update the .env file with your configuration')
console.log('2. Start the development server: npm run dev')
console.log('3. Open http://localhost:3000 in your browser')
console.log('4. Login with admin@example.com / AdminPassword123')
console.log('\n⚠️  Remember to change the default admin password!') 