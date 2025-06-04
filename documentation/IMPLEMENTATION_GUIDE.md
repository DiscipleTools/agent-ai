# Agent AI Server - Implementation Guide

## 1. Project Setup

### 1.1 Initialize Project Structure
```
agent-ai-server/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── app.js
├── config/
├── uploads/
├── tests/
├── docker/
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

### 1.2 Package Dependencies
```json
{
  "name": "agent-ai-server",
  "version": "1.0.0",
  "description": "AI Agent Server for Chatwoot Integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "multer": "^1.4.5-lts.1",
    "joi": "^17.9.2",
    "dotenv": "^16.3.1",
    "axios": "^1.5.0",
    "crypto": "^1.0.1",
    "express-validator": "^7.0.1",
    "winston": "^3.10.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.4",
    "supertest": "^6.3.3",
    "eslint": "^8.48.0"
  }
}
```

## 2. Environment Configuration

### 2.1 Environment Variables (.env.example)
```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/agent-ai-server
MONGODB_TEST_URI=mongodb://localhost:27017/agent-ai-server-test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Chatwoot Integration
CHATWOOT_URL=https://your-chatwoot-instance.com
CHATWOOT_API_TOKEN=your-chatwoot-api-token

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,txt,doc,docx

# Webhook Configuration
WEBHOOK_SECRET=your-webhook-secret

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Logging
LOG_LEVEL=info
```

## 3. Database Models Implementation

### 3.1 User Model (src/models/User.js)
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  agentAccess: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: Date,
  refreshTokens: [String]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

### 3.2 Agent Model (src/models/Agent.js)
```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const contextDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['file', 'url'],
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
  }
});

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  prompt: {
    type: String,
    required: true
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
      min: 0,
      max: 1
    },
    maxTokens: {
      type: Number,
      default: 500,
      min: 1,
      max: 2000
    },
    responseDelay: {
      type: Number,
      default: 0,
      min: 0,
      max: 30
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
  timestamps: true
});

// Generate webhook URL before saving
agentSchema.pre('save', function(next) {
  if (!this.webhookUrl) {
    const webhookId = crypto.randomBytes(16).toString('hex');
    this.webhookUrl = `/webhook/agent/${webhookId}`;
  }
  next();
});

module.exports = mongoose.model('Agent', agentSchema);
```

## 4. Core Services Implementation

### 4.1 Authentication Service (src/services/authService.js)
```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

class AuthService {
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    const refreshToken = jwt.sign(
      { userId, tokenId: crypto.randomBytes(16).toString('hex') },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE }
    );

    return { accessToken, refreshToken };
  }

  async verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async login(email, password) {
    const user = await User.findOne({ email, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      throw new Error('Invalid credentials');
    }

    const tokens = this.generateTokens(user._id);
    
    // Store refresh token
    user.refreshTokens.push(tokens.refreshToken);
    user.lastLogin = new Date();
    await user.save();

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tokens
    };
  }

  async refreshTokens(refreshToken) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

    // Remove old refresh token and generate new tokens
    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    const newTokens = this.generateTokens(user._id);
    user.refreshTokens.push(newTokens.refreshToken);
    await user.save();

    return newTokens;
  }

  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
      await user.save();
    }
  }
}

module.exports = new AuthService();
```

### 4.2 AI Service (src/services/aiService.js)
```javascript
const axios = require('axios');

class AIService {
  constructor() {
    // AI configuration will be handled through database settings
  }

  async generateResponse(prompt, context, userMessage, settings = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(prompt, context);
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        {
          model: 'Neural-Chat-7B',
          messages,
          temperature: settings.temperature || 0.3,
          max_tokens: settings.maxTokens || 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('AI Service Error:', error.response?.data || error.message);
      throw new Error('Failed to generate AI response');
    }
  }

  buildSystemPrompt(agentPrompt, contextDocuments) {
    let systemPrompt = agentPrompt;

    if (contextDocuments && contextDocuments.length > 0) {
      systemPrompt += '\n\nAdditional Context:\n';
      contextDocuments.forEach(doc => {
        systemPrompt += `\n${doc.content}\n`;
      });
    }

    return systemPrompt;
  }
}

module.exports = new AIService();
```

### 4.3 Webhook Service (src/services/webhookService.js)
```javascript
const Agent = require('../models/Agent');
const aiService = require('./aiService');
const chatwootService = require('./chatwootService');

class WebhookService {
  async processWebhook(agentId, payload) {
    try {
      const agent = await Agent.findById(agentId);
      if (!agent || !agent.isActive) {
        throw new Error('Agent not found or inactive');
      }

      // Parse Chatwoot webhook payload
      const { conversation, message } = this.parsePayload(payload);
      
      // Skip if message is from agent
      if (message.message_type === 'outgoing') {
        return { success: true, skipped: 'outgoing message' };
      }

      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        agent.prompt,
        agent.contextDocuments,
        message.content,
        agent.settings
      );

      // Add delay if configured
      if (agent.settings.responseDelay > 0) {
        await this.delay(agent.settings.responseDelay * 1000);
      }

      // Send response back to Chatwoot
      await chatwootService.sendMessage(
        conversation.account_id,
        conversation.id,
        aiResponse
      );

      return { success: true, response: aiResponse };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  parsePayload(payload) {
    // Extract conversation and message from Chatwoot webhook
    return {
      conversation: payload.conversation,
      message: payload.message
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WebhookService();
```

### 4.4 Chatwoot Service (src/services/chatwootService.js)
```javascript
const axios = require('axios');

class ChatwootService {
  async sendMessage(accountId, conversationId, content) {
    try {
      // This would typically use Chatwoot's API to send a message
      // For now, we'll log the response (in production, implement actual API call)
      console.log(`Sending message to Chatwoot:`, {
        accountId,
        conversationId,
        content
      });

      // Example implementation (uncomment and configure for production):
      /*
      const response = await axios.post(
        `${process.env.CHATWOOT_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
        {
          content,
          message_type: 'outgoing'
        },
        {
          headers: {
            'api_access_token': process.env.CHATWOOT_API_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
      */

      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      console.error('Chatwoot Service Error:', error.response?.data || error.message);
      throw new Error('Failed to send message to Chatwoot');
    }
  }
}

module.exports = new ChatwootService();
```

## 5. API Controllers Implementation

### 5.1 Auth Controller (src/controllers/authController.js)
```javascript
const authService = require('../services/authService');
const { validationResult } = require('express-validator');

class AuthController {
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(refreshToken);

      res.json({
        success: true,
        data: tokens
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user.userId, refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();
```

### 5.2 Agent Controller (src/controllers/agentController.js)
```javascript
const Agent = require('../models/Agent');
const { validationResult } = require('express-validator');

class AgentController {
  async getAgents(req, res) {
    try {
      const user = req.user;
      let query = {};

      // If not admin, only show agents user has access to
      if (user.role !== 'admin') {
        query._id = { $in: user.agentAccess };
      }

      const agents = await Agent.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: agents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async createAgent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const agentData = {
        ...req.body,
        createdBy: req.user.userId
      };

      const agent = new Agent(agentData);
      await agent.save();

      res.status(201).json({
        success: true,
        data: agent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getAgent(req, res) {
    try {
      const { id } = req.params;
      const agent = await Agent.findById(id).populate('createdBy', 'name email');

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Check access permissions
      if (req.user.role !== 'admin' && !req.user.agentAccess.includes(id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: agent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateAgent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const agent = await Agent.findById(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Check access permissions
      if (req.user.role !== 'admin' && !req.user.agentAccess.includes(id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      Object.assign(agent, req.body);
      await agent.save();

      res.json({
        success: true,
        data: agent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteAgent(req, res) {
    try {
      const { id } = req.params;
      const agent = await Agent.findById(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Check access permissions
      if (req.user.role !== 'admin' && !req.user.agentAccess.includes(id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await Agent.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AgentController();
```

## 6. Middleware Implementation

### 6.1 Authentication Middleware (src/middleware/auth.js)
```javascript
const authService = require('../services/authService');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = await authService.verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
```

### 6.2 Validation Middleware (src/middleware/validation.js)
```javascript
const { body, param } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
];

const agentValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('prompt').trim().isLength({ min: 10, max: 2000 }),
  body('settings.temperature').optional().isFloat({ min: 0, max: 1 }),
  body('settings.maxTokens').optional().isInt({ min: 1, max: 2000 }),
  body('settings.responseDelay').optional().isInt({ min: 0, max: 30 })
];

const userValidation = [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('role').optional().isIn(['admin', 'user'])
];

module.exports = {
  loginValidation,
  agentValidation,
  userValidation
};
```

## 7. Application Setup

### 7.1 Main Application (src/app.js)
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const agentRoutes = require('./routes/agents');
const webhookRoutes = require('./routes/webhooks');
const settingsRoutes = require('./routes/settings');

// Import middleware
const { authenticate } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/agents', authenticate, agentRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/webhook', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

module.exports = app;
```

### 7.2 Server Entry Point (server.js)
```javascript
const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
```

## 8. Testing Strategy

### 8.1 Test Configuration (jest.config.js)
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

### 8.2 Test Setup (tests/setup.js)
```javascript
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

## 9. Deployment Configuration

### 9.1 Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
```

### 9.2 Docker Compose (docker-compose.yml)
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/agent-ai-server
    depends_on:
      - mongo
    volumes:
      - ./uploads:/app/uploads

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## 10. Development Workflow

### 10.1 Development Scripts
```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "docker:build": "docker build -t agent-ai-server .",
    "docker:run": "docker-compose up -d"
  }
}
```

### 10.2 Git Hooks (package.json)
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm test"
    }
  },
  "lint-staged": {
    "src/**/*.js": [
      "eslint --fix",
      "git add"
    ]
  }
}
```

This implementation guide provides a comprehensive foundation for building the Agent AI Server. Each component is designed to be modular, testable, and scalable, following Node.js best practices and security guidelines. 