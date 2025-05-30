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