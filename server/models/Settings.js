import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema({
  predictionGuard: {
    apiKey: {
      type: String,
      required: false
    },
    endpoint: {
      type: String,
      required: false,
      default: 'https://api.predictionguard.com'
    },
    model: {
      type: String,
      required: false,
      default: 'Hermes-3-Llama-3.1-8B'
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

export default mongoose.model('Settings', settingsSchema) 