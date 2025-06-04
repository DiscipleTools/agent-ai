import mongoose from 'mongoose'

const aiConnectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  apiKey: {
    type: String,
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['openai', 'prediction-guard', 'custom'],
    default: 'custom'
  },
  availableModels: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  _id: true
})

const settingsSchema = new mongoose.Schema({
  // AI connections structure
  aiConnections: [aiConnectionSchema],
  defaultConnection: {
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    modelId: {
      type: String,
      required: false
    }
  },
  email: {
    provider: {
      type: String,
      enum: ['smtp'],
      default: 'smtp'
    },
    smtp: {
      host: {
        type: String,
        required: false
      },
      port: {
        type: Number,
        default: 587
      },
      secure: {
        type: Boolean,
        default: false
      },
      auth: {
        user: {
          type: String,
          required: false
        },
        pass: {
          type: String,
          required: false
        }
      }
    },
    from: {
      email: {
        type: String,
        required: false
      },
      name: {
        type: String,
        default: 'Agent AI Server'
      }
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  server: {
    webhookSecret: {
      type: String,
      required: false
    },
    maxFileSize: {
      type: Number,
      default: 10485760 // 10MB
    },
    allowedFileTypes: {
      type: [String],
      default: ['pdf', 'txt', 'doc', 'docx']
    }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

// Ensure only one settings document exists
settingsSchema.index({}, { unique: true })

export default mongoose.models.Settings || mongoose.model('Settings', settingsSchema) 