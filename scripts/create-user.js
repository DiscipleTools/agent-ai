#!/usr/bin/env node

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
require('dotenv').config()

// User schema (simplified version for the script)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  agentAccess: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: Date,
  refreshTokens: [String]
}, {
  timestamps: true
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

async function createUser() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    console.log('Connecting to MongoDB...')
    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB successfully')

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'user@example.com' })
    if (existingUser) {
      console.log('❌ User with email user@example.com already exists')
      console.log('User details:')
      console.log(`  - ID: ${existingUser._id}`)
      console.log(`  - Name: ${existingUser.name}`)
      console.log(`  - Email: ${existingUser.email}`)
      console.log(`  - Role: ${existingUser.role}`)
      console.log(`  - Active: ${existingUser.isActive}`)
      console.log(`  - Created: ${existingUser.createdAt}`)
      return
    }

    // Find admin user to set as invitedBy
    const adminUser = await User.findOne({ role: 'admin' })
    
    // Create new user
    const userData = {
      email: 'user@example.com',
      name: 'Regular User',
      password: 'UserPassword123', // Default password
      role: 'user',
      isActive: true,
      agentAccess: [],
      invitedBy: adminUser ? adminUser._id : null
    }

    console.log('Creating new user...')
    const user = new User(userData)
    await user.save()

    console.log('✅ User created successfully!')
    console.log('User details:')
    console.log(`  - ID: ${user._id}`)
    console.log(`  - Name: ${user.name}`)
    console.log(`  - Email: ${user.email}`)
    console.log(`  - Role: ${user.role}`)
    console.log(`  - Active: ${user.isActive}`)
            console.log(`  - Password: [HIDDEN]`)
    console.log(`  - Created: ${user.createdAt}`)
    
    if (adminUser) {
      console.log(`  - Invited by: ${adminUser.name} (${adminUser.email})`)
    }

            console.log('\n🔑 Login credentials:')
        console.log('  Email: user@example.com')
        console.log('  Password: [HIDDEN - Default password set]')

  } catch (error) {
    console.error('❌ Error creating user:', error.message)
    if (error.code === 11000) {
      console.error('User with this email already exists')
    }
  } finally {
    // Close database connection
    await mongoose.connection.close()
    console.log('\nDatabase connection closed')
  }
}

// Run the script
if (require.main === module) {
  createUser()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Script failed:', error)
      process.exit(1)
    })
}

module.exports = { createUser } 