import mongoose from 'mongoose'
import crypto from 'crypto'

const agentAssignmentSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  agentType: {
    type: String,
    enum: ['pre-process', 'analytics', 'moderation', 'routing', 'post-process'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  priority: {
    type: Number,
    default: 100,
    min: [1, 'Priority must be at least 1'],
    max: [999, 'Priority cannot exceed 999']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

const inboxSchema = new mongoose.Schema({
  // Identity
  accountId: {
    type: Number,
    required: [true, 'Chatwoot account ID is required']
  },
  inboxId: {
    type: Number,
    required: [true, 'Chatwoot inbox ID is required']
  },
  name: {
    type: String,
    required: [true, 'Inbox name is required'],
    trim: true,
    maxlength: [100, 'Inbox name cannot exceed 100 characters']
  },
  channelType: {
    type: String,
    enum: ['email', 'web_widget', 'api', 'whatsapp', 'facebook', 'twitter', 'telegram', 'line', 'sms', 'website'],
    required: [true, 'Channel type is required']
  },
  
  // Webhook Configuration
  webhookUrl: {
    type: String,
    unique: true
  },
  webhookSecret: {
    type: String,
    required: true
  },
  
  // Chatwoot Integration
  chatwoot: {
    apiKey: {
      type: String,
      required: false,
      trim: true
    },
    botId: {
      type: Number,
      required: false
    },
    botName: {
      type: String,
      required: false,
      trim: true
    },
    isConfigured: {
      type: Boolean,
      default: false
    },
    lastSync: {
      type: Date,
      required: false
    }
  },
  
  // Response Agent (Constraint: Only ONE allowed)
  responseAgent: {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: false
    },
    assignedAt: {
      type: Date,
      required: false
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Additional Agents (Multiple allowed)
  agents: [agentAssignmentSchema],
  
  // Settings
  settings: {
    processDelay: {
      type: Number,
      default: 0,
      min: [0, 'Process delay cannot be negative'],
      max: [60, 'Process delay cannot exceed 60 seconds']
    },
    enableLogging: {
      type: Boolean,
      default: true
    },
    enableAnalytics: {
      type: Boolean,
      default: true
    }
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Ensure responseAgent field is always present
      if (!ret.responseAgent) {
        ret.responseAgent = null;
      }
      return ret;
    }
  }
})

// Indexes for better performance
inboxSchema.index({ accountId: 1, inboxId: 1 }, { unique: true })
inboxSchema.index({ 'responseAgent.agentId': 1 })
inboxSchema.index({ 'agents.agentId': 1 })
inboxSchema.index({ isActive: 1 })
inboxSchema.index({ createdBy: 1 })
inboxSchema.index({ channelType: 1 })
inboxSchema.index({ 'chatwoot.isConfigured': 1 })

// Generate webhook URL and secret before saving
inboxSchema.pre('save', function(next) {
  if (!this.webhookUrl) {
    const webhookId = crypto.randomBytes(16).toString('hex')
    this.webhookUrl = `/api/webhook/inbox/${webhookId}`
  }
  
  if (!this.webhookSecret) {
    this.webhookSecret = crypto.randomBytes(32).toString('hex')
  }
  
  next()
})

// Static method to find active inboxes
inboxSchema.statics.findActive = function() {
  return this.find({ isActive: true })
}

// Static method to find inboxes by creator
inboxSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId, isActive: true })
}

// Static method to find inbox by account and inbox ID
inboxSchema.statics.findByChatwootId = function(accountId, inboxId) {
  return this.findOne({ accountId, inboxId, isActive: true })
}

// Instance method to add agent to agents array
inboxSchema.methods.addAgent = function(agentId, agentType, name, priority = 100, config = {}) {
  // Check if agent is already assigned
  const existingAgent = this.agents.find(a => a.agentId.toString() === agentId.toString())
  if (existingAgent) {
    throw new Error('Agent is already assigned to this inbox')
  }
  
  this.agents.push({
    agentId,
    agentType,
    name,
    priority,
    isActive: true,
    config,
    assignedAt: new Date()
  })
  
  // Sort agents by priority after adding
  this.agents.sort((a, b) => a.priority - b.priority)
  
  return this
}

// Instance method to remove agent from agents array
inboxSchema.methods.removeAgent = function(agentId) {
  const agentIndex = this.agents.findIndex(a => a.agentId.toString() === agentId.toString())
  if (agentIndex === -1) {
    throw new Error('Agent is not assigned to this inbox')
  }
  
  this.agents.splice(agentIndex, 1)
  return this
}

// Instance method to update agent config
inboxSchema.methods.updateAgentConfig = function(agentId, config) {
  const agent = this.agents.find(a => a.agentId.toString() === agentId.toString())
  if (!agent) {
    throw new Error('Agent is not assigned to this inbox')
  }
  
  agent.config = { ...agent.config, ...config }
  return this
}

// Instance method to assign response agent (validates single agent constraint)
inboxSchema.methods.assignResponseAgent = function(agentId, config = {}) {
  this.responseAgent = {
    agentId,
    assignedAt: new Date(),
    config
  }
  
  return this
}

// Instance method to remove response agent
inboxSchema.methods.removeResponseAgent = function() {
  this.responseAgent = {
    agentId: undefined,
    assignedAt: undefined,
    config: {}
  }
  
  return this
}

// Instance method to get all agents sorted by priority
inboxSchema.methods.getActiveAgentsSorted = function() {
  return this.agents
    .filter(a => a.isActive)
    .sort((a, b) => a.priority - b.priority)
}

// Instance method to get agents by priority range
inboxSchema.methods.getAgentsByPriorityRange = function(minPriority, maxPriority = null) {
  const activeAgents = this.getActiveAgentsSorted()
  
  if (maxPriority === null) {
    return activeAgents.filter(a => a.priority >= minPriority)
  }
  
  return activeAgents.filter(a => a.priority >= minPriority && a.priority < maxPriority)
}

// Virtual for inbox's basic info
inboxSchema.virtual('info').get(function() {
  return {
    id: this._id,
    accountId: this.accountId,
    inboxId: this.inboxId,
    name: this.name,
    channelType: this.channelType,
    webhookUrl: this.webhookUrl,
    isActive: this.isActive,
    createdAt: this.createdAt,
    responseAgentAssigned: !!this.responseAgent?.agentId,
    agentCount: this.agents.length,
    activeAgentCount: this.agents.filter(a => a.isActive).length
  }
})

const Inbox = mongoose.models.Inbox || mongoose.model('Inbox', inboxSchema)

export default Inbox