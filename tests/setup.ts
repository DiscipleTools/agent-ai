import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import mongoose from 'mongoose'
import User from '~/server/models/User'
import Agent from '~/server/models/Agent'
import jwt from 'jsonwebtoken'

// Load environment variables from .env file
import { config } from 'dotenv'
config()

// Test database configuration - use main database for true integration testing
const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
// Use the same JWT secrets as the dev server from .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-this-in-production'

// Ensure NODE_ENV is set to test for any test-specific behavior
process.env.NODE_ENV = 'test'

console.log('Test setup - Using JWT_SECRET from .env:', JWT_SECRET.substring(0, 10) + '...')
console.log('Test setup - NODE_ENV:', process.env.NODE_ENV)

// Test users with consistent IDs
export const testUsers = {
  admin: {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'admin@test.com',
    name: 'Test Admin',
    password: 'password123',
    role: 'admin' as const,
    isActive: true,
    agentAccess: [] as mongoose.Types.ObjectId[]
  },
  user: {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
    email: 'user@test.com',
    name: 'Test User',
    password: 'password123',
    role: 'user' as const,
    isActive: true,
    agentAccess: [] as mongoose.Types.ObjectId[]
  },
  inactive: {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
    email: 'inactive@test.com',
    name: 'Inactive User',
    password: 'password123',
    role: 'user' as const,
    isActive: false,
    agentAccess: [] as mongoose.Types.ObjectId[]
  }
}

// Test agents
export const testAgents = {
  publicAgent: {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    name: 'Public Agent',
    description: 'Test agent accessible to admin only',
    prompt: 'You are a test agent for admin users',
    isActive: true,
    createdBy: testUsers.admin._id
  },
  userAgent: {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
    name: 'User Agent',
    description: 'Test agent for user',
    prompt: 'You are a test agent for regular users',
    isActive: true,
    createdBy: testUsers.user._id
  }
}

// Update user agent access
testUsers.user.agentAccess = [testAgents.userAgent._id]

// Track agents created during tests for cleanup
export const createdAgentIds: mongoose.Types.ObjectId[] = []

// Helper function to generate JWT tokens using the same secrets as the server
export function generateTestToken(userId: string, type: 'access' | 'refresh' = 'access'): string {
  const secret = type === 'access' ? JWT_SECRET : JWT_REFRESH_SECRET
  const expiresIn = type === 'access' ? '1h' : '7d'
  
  return jwt.sign(
    { 
      userId,
      type
    },
    secret,
    { 
      expiresIn,
      issuer: 'agent-ai-server',
      audience: 'agent-ai-client'
    }
  )
}

// Helper function to get auth headers for tests
export function getAuthHeaders(userType: 'admin' | 'user' | 'inactive'): Record<string, string> {
  const userId = testUsers[userType]._id.toString()
  const token = generateTestToken(userId, 'access')
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

// Helper function to clean up only test data (preserves real data)
async function cleanTestData() {
  try {
    // Only delete test users by their specific IDs
    const testUserIds = [
      testUsers.admin._id,
      testUsers.user._id,
      testUsers.inactive._id
    ]
    
    const deletedUsers = await User.deleteMany({
      _id: { $in: testUserIds }
    })
    
    // Only delete test agents by their specific IDs
    const testAgentIds = [
      testAgents.publicAgent._id,
      testAgents.userAgent._id
    ]
    
    const deletedAgents = await Agent.deleteMany({
      _id: { $in: testAgentIds }
    })
    
    // Also clean up any agents created during tests
    if (createdAgentIds.length > 0) {
      const deletedCreatedAgents = await Agent.deleteMany({
        _id: { $in: createdAgentIds }
      })
      console.log(`Also cleaned ${deletedCreatedAgents.deletedCount} agents created during tests`)
      // Clear the tracking array
      createdAgentIds.length = 0
    }
    
    // Wait a bit to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    console.log(`Cleaned ${deletedUsers.deletedCount} test users and ${deletedAgents.deletedCount} test agents`)
  } catch (error) {
    console.error('Error cleaning test data:', error)
    // If collections don't exist yet, that's fine
  }
}

// Helper function to seed test data
async function seedTestData() {
  try {
    // Create test users with plain passwords (will be hashed by pre-save middleware)
    const users = await User.create([
      testUsers.admin,
      testUsers.user,
      testUsers.inactive
    ])
    
    // Create test agents
    const agents = await Agent.create([
      testAgents.publicAgent,
      testAgents.userAgent
    ])
    
    console.log(`Seeded ${users.length} users and ${agents.length} agents`)
  } catch (error) {
    console.error('Error seeding test data:', error)
    throw error
  }
}

// Test lifecycle hooks
beforeAll(async () => {
  try {
    console.log('Setting up test database...')
    await mongoose.connect(TEST_DB_URI)
    await cleanTestData()
    console.log('Test database setup complete')
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
})

beforeEach(async () => {
  try {
    await cleanTestData()
    await seedTestData()
  } catch (error) {
    console.error('Failed to setup test data:', error)
    throw error
  }
})

afterEach(async () => {
  // Optional: Clean up after each test
  // await cleanTestData()
})

afterAll(async () => {
  try {
    await cleanTestData()
    await mongoose.disconnect()
    console.log('Test database cleanup complete')
  } catch (error) {
    console.error('Failed to cleanup test database:', error)
  }
}) 