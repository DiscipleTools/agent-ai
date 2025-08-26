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
  webhookUrl: {
    type: String,
    unique: true
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
    },
    chatwootApiKey: {
      type: String,
      required: false,
      trim: true
    }
  },
  inboxes: [{
    accountId: {
      type: Number,
      required: true
    },
    inboxId: {
      type: Number,
      required: true
    },
    accountName: String,
    inboxName: String,
    channelType: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.Mixed, // Support both ObjectId and simple IDs for Chatwoot users
    required: true
  },
  agentType: {
    type: String,
    enum: ['response', 'analytics', 'moderation', 'routing'],
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
// Compound index to track agents by inbox - for validation purposes only (not unique constraint)
agentSchema.index({ 'inboxes.accountId': 1, 'inboxes.inboxId': 1, agentType: 1, isActive: 1 })

// Generate webhook URL before saving
agentSchema.pre('save', function(next) {
  if (!this.webhookUrl) {
    const webhookId = crypto.randomBytes(16).toString('hex')
    this.webhookUrl = `/api/webhook/agent/${webhookId}`
  }
  next()
})

// Static method to find active agents
agentSchema.statics.findActive = function() {
  return this.find({ isActive: true })
}

// Static method to find agents by creator
agentSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId, isActive: true })
}

// Static method to validate inbox assignments for response agents
agentSchema.statics.validateResponseAgentInboxes = async function(inboxes, excludeAgentId = null) {
  if (!inboxes || !Array.isArray(inboxes) || inboxes.length === 0) {
    return { isValid: true, conflicts: [] }
  }

  const conflicts = []
  
  for (const inbox of inboxes) {
    const query = {
      'inboxes.accountId': inbox.accountId,
      'inboxes.inboxId': inbox.inboxId,
      agentType: 'response',
      isActive: true
    }
    
    // Exclude the current agent if we're updating
    if (excludeAgentId) {
      query._id = { $ne: excludeAgentId }
    }
    
    const existingAgent = await this.findOne(query)
    
    if (existingAgent) {
      conflicts.push({
        accountId: inbox.accountId,
        inboxId: inbox.inboxId,
        accountName: inbox.accountName,
        inboxName: inbox.inboxName,
        existingAgentId: existingAgent._id,
        existingAgentName: existingAgent.name
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
    isActive: this.isActive,
    webhookUrl: this.webhookUrl,
    createdAt: this.createdAt
  }
})

const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)

export default Agent 