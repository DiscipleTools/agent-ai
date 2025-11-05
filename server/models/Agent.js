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
  
  // Workflow system fields (3-section structure: triggers, conditions, actions)
  workflow: {
    // Section 1: Triggers - Events that start the workflow
    triggers: [{
      type: {
        type: String,
        enum: [
          // Conversation events
          'conversation_created',
          'conversation_status_changed',
          'conversation_assigned',

          // Message events
          'message_created',
        ],
        required: [true, 'Trigger type is required']
      }
    }],

    // Section 2: Conditions - Filters that must be met for workflow to execute
    conditions: [{
      type: {
        type: String,
        enum: [
          'conversation_status',    // Check conversation status
          'message_contains',       // Check if message contains text
          'message_is_toxic'        // Check if message is toxic (async API call)
        ],
        required: [true, 'Condition type is required']
      },
      operator: {
        type: String,
        enum: ['equals', 'contains'],
        default: 'equals'
      },
      value: mongoose.Schema.Types.Mixed,
      logicalOperator: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
      },
      examples: {
        type: String,
        default: ''
      }
    }],

    // Section 3: Actions - What to do when triggered and conditions met
    actions: [{
      type: {
        type: String,
        enum: [
          // AI-powered actions
          'ai_response',
          'ai_summarize',
          'ai_categorize',
          'ai_sentiment_analysis',
          
          // Conversation management
          'change_status',
          'assign_agent',
          'add_private_note',
          'add_public_note',
          'set_priority',
          'set_custom_attribute',
          'update_contact_attribute',
          'mark_contact_hostile',
          'add_label',


          // Flow control
          'wait',
          'stop_workflow'
        ],
        required: [true, 'Action type is required']
      },
      parameters: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      order: {
        type: Number,
        default: 1
      },
      continueOnFailure: {
        type: Boolean,
        default: false
      },
      delay: {
        type: Number,
        default: 0,
        min: [0, 'Delay cannot be negative']
      }
    }],
    
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  // Workflow execution settings
  priority: {
    type: Number,
    default: 1,
    min: [1, 'Priority must be at least 1'],
    max: [10, 'Priority cannot exceed 10']
  },
  retryOnFailure: {
    type: Boolean,
    default: true
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: [0, 'Max retries cannot be negative'],
    max: [5, 'Max retries cannot exceed 5']
  },
  
  // Analytics and execution tracking
  analytics: {
    executionCount: {
      type: Number,
      default: 0
    },
    successCount: {
      type: Number, 
      default: 0
    },
    failureCount: {
      type: Number,
      default: 0
    },
    avgExecutionTime: {
      type: Number,
      default: 0
    },
    lastExecutedAt: {
      type: Date
    }
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
agentSchema.index({ 'workflow.triggers.type': 1 })
agentSchema.index({ 'workflow.isActive': 1 })
agentSchema.index({ priority: 1 })
agentSchema.index({ 'analytics.lastExecutedAt': 1 })


// Static method to find active agents
agentSchema.statics.findActive = function() {
  return this.find({ isActive: true })
}

// Static method to find agents by creator
agentSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId, isActive: true })
}

// Static method to find agents by trigger type
agentSchema.statics.findByTriggerType = function(triggerType, inboxIds = []) {
  const query = {
    isActive: true,
    'workflow.isActive': true,
    'workflow.triggers.type': triggerType
  }

  // If inbox IDs provided, filter by assigned inboxes
  if (inboxIds.length > 0) {
    // This would need to be combined with Inbox model queries
    // For now, we'll handle inbox filtering in the service layer
  }

  return this.find(query).sort({ priority: 1 })
}

// Static method to find all agents
agentSchema.statics.findAllAgents = function(userId = null) {
  const query = {
    isActive: true
  }
  
  if (userId) {
    query.createdBy = userId
  }
  
  return this.find(query)
}

// Method to update analytics
agentSchema.methods.updateAnalytics = function(executionTime, success = true) {
  const analytics = this.analytics
  
  analytics.executionCount += 1
  if (success) {
    analytics.successCount += 1
  } else {
    analytics.failureCount += 1
  }
  
  // Update running average execution time
  if (analytics.executionCount === 1) {
    analytics.avgExecutionTime = executionTime
  } else {
    analytics.avgExecutionTime = ((analytics.avgExecutionTime * (analytics.executionCount - 1)) + executionTime) / analytics.executionCount
  }
  
  analytics.lastExecutedAt = new Date()
  
  return this.save()
}

// Static method to get assigned inboxes (computed from Inbox model)
agentSchema.statics.getAssignedInboxes = async function(agentId) {
  const Inbox = mongoose.model('Inbox')
  return await Inbox.find({
    'agents.agentId': agentId
  })
}

// Static method to validate response agent inbox constraints (removed - responseAgent functionality removed)
agentSchema.statics.validateResponseAgentInboxes = async function(inboxIds, excludeAgentId = null) {
  // Response agent functionality removed
  return {
    isValid: true,
    conflicts: []
  }
}

// Virtual for agent's basic info
agentSchema.virtual('info').get(function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    isActive: this.isActive,
    createdAt: this.createdAt
  }
})

const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)

export default Agent 