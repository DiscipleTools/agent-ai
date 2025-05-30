/**
 * Migration Script: Fix Agent Permissions
 * 
 * This script grants users access to agents they created but don't have permission to see.
 * Run this if you have agents created before the permission fix was implemented.
 * 
 * Usage: node scripts/fix-agent-permissions.js
 */

import mongoose from 'mongoose'
import Agent from '../server/models/Agent.js'
import User from '../server/models/User.js'

async function fixAgentPermissions() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-ai-server'
    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    // Find all agents with their creators
    const agents = await Agent.find().populate('createdBy')
    console.log(`Found ${agents.length} agents`)

    let updatedCount = 0

    for (const agent of agents) {
      if (!agent.createdBy) {
        console.log(`Agent ${agent.name} has no creator, skipping...`)
        continue
      }

      // Skip if creator is admin (admins have access to all agents)
      if (agent.createdBy.role === 'admin') {
        console.log(`Agent ${agent.name} created by admin ${agent.createdBy.name}, skipping...`)
        continue
      }

      // Check if user already has access to this agent
      const user = await User.findById(agent.createdBy._id)
      if (!user) {
        console.log(`Creator user not found for agent ${agent.name}, skipping...`)
        continue
      }

      const hasAccess = user.agentAccess && user.agentAccess.some(id => id.toString() === agent._id.toString())
      
      if (hasAccess) {
        console.log(`User ${user.name} already has access to agent ${agent.name}`)
        continue
      }

      // Grant access to the agent
      await User.findByIdAndUpdate(
        user._id,
        { $addToSet: { agentAccess: agent._id } },
        { new: true }
      )

      console.log(`✅ Granted ${user.name} access to agent ${agent.name}`)
      updatedCount++
    }

    console.log(`\n🎉 Migration completed! Updated permissions for ${updatedCount} agents.`)

  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

// Run the migration
fixAgentPermissions() 