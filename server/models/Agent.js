import mongoose from 'mongoose'
import crypto from 'crypto'

const contextDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['file', 'url', 'website'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  filename: String,
  url: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
})

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Agent name is required'],
    trim: true,
    minlength: [1, 'Agent name must be at least 1 character long'],
    maxlength: [100, 'Agent name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  prompt: {
    type: String,
    required: [true, 'System prompt is required'],
    minlength: [10, 'Prompt must be at least 10 characters long'],
    maxlength: [2000, 'Prompt cannot exceed 2000 characters']
  },
  contextDocuments: [contextDocumentSchema],
  settings: {
    temperature: {
      type: Number,
      default: 0.3,
      min: [0, 'Temperature must be between 0 and 1'],
      max: [1, 'Temperature must be between 0 and 1']
    },
    maxTokens: {
      type: Number,
      default: 500,
      min: [1, 'Max tokens must be at least 1'],
      max: [2000, 'Max tokens cannot exceed 2000']
    },
    responseDelay: {
      type: Number,
      default: 0,
      min: [0, 'Response delay cannot be negative'],
      max: [30, 'Response delay cannot exceed 30 seconds']
    },
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    modelId: {
      type: String,
      required: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.Mixed, // Support both ObjectId and simple IDs for Chatwoot users
    required: true
  },
  agentType: {
    type: String,
    enum: ['response', 'pre-process', 'analytics', 'moderation', 'routing', 'post-process'],
    default: 'response',
    required: [true, 'Agent type is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      return ret;
    }
  }
})

// Indexes for better performance
agentSchema.index({ isActive: 1 })
agentSchema.index({ createdBy: 1 })
agentSchema.index({ agentType: 1 })


// Static method to find active agents
agentSchema.statics.findActive = function() {
  return this.find({ isActive: true })
}

// Static method to find agents by creator
agentSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId, isActive: true })
}

// Static method to get assigned inboxes (computed from Inbox model)
agentSchema.statics.getAssignedInboxes = async function(agentId) {
  const Inbox = mongoose.model('Inbox')
  return await Inbox.find({
    $or: [
      { 'responseAgent.agentId': agentId },
      { 'agents.agentId': agentId }
    ]
  })
}

// Static method to validate response agent inbox constraints
agentSchema.statics.validateResponseAgentInboxes = async function(inboxIds, excludeAgentId = null) {
  const Inbox = mongoose.model('Inbox')
  
  const conflicts = []
  
  // Check each inbox for existing response agents
  for (const inboxId of inboxIds) {
    const inbox = await Inbox.findById(inboxId).populate('responseAgent.agentId')
    
    if (inbox && inbox.responseAgent && inbox.responseAgent.agentId) {
      // Skip if it's the same agent being updated
      if (excludeAgentId && inbox.responseAgent.agentId._id.toString() === excludeAgentId.toString()) {
        continue
      }
      
      conflicts.push({
        inboxId: inbox._id,
        inboxName: inbox.name,
        existingAgentId: inbox.responseAgent.agentId._id,
        existingAgentName: inbox.responseAgent.agentId.name
      })
    }
  }
  
  return {
    isValid: conflicts.length === 0,
    conflicts
  }
}

// Virtual for agent's basic info
agentSchema.virtual('info').get(function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    agentType: this.agentType,
    isActive: this.isActive,
    createdAt: this.createdAt
  }
})

const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)

export default Agent 