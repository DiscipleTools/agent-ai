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
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
      return ret;
    }
  }
})

// Indexes for better performance
agentSchema.index({ isActive: 1 })
agentSchema.index({ createdBy: 1 })

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