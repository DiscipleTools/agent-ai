# Agent AI Server - Project Specification

## 1. Project Overview

### 1.1 Purpose
The Agent AI Server is a Node.js-based backend system designed to integrate with Chatwoot instances and provide AI-powered conversational agents. The system enables organizations to deploy multiple AI agents that can automatically respond to customer inquiries via chat and email.

### 1.2 Key Features
- Multi-tenant AI agent management
- Chatwoot webhook integration
- User authentication and role-based access control
- AI-powered conversation responses via Prediction Guard API
- Agent customization with prompts and context documents
- Admin dashboard for user and agent management

## 2. System Architecture

### 2.1 High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chatwoot      │    │   Agent AI      │    │  Prediction     │
│   Instance      │───▶│   Server        │───▶│  Guard API      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Database      │
                       │   (MongoDB)     │
                       └─────────────────┘
```

### 2.2 Technology Stack
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **AI Integration**: Prediction Guard API
- **File Storage**: Local filesystem or cloud storage
- **Environment**: Docker containerization support

## 3. Core Components

### 3.1 Authentication System
- **Login Only**: No user registration endpoint
- **Invitation System**: Admin-only user invitation workflow
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Admin and regular user roles

### 3.2 User Management
- **User Roles**: Admin and Standard User
- **Admin Capabilities**:
  - Invite new users
  - Edit user permissions
  - Remove users
  - Assign agent access permissions
- **User Capabilities**:
  - Create and manage assigned agents
  - View agent analytics

### 3.3 Agent Management
- **Agent Creation**: Custom prompt configuration
- **Context Enhancement**: URL and file upload support
- **Webhook Generation**: Unique webhook URLs per agent
- **Agent Configuration**:
  - Name and description
  - Custom system prompt
  - Context documents/URLs
  - Response settings

### 3.4 Webhook Processing
- **Webhook Handling**: Receive Chatwoot webhooks
- **Message Processing**: Parse incoming messages/emails
- **AI Response Generation**: Use Prediction Guard API
- **Response Delivery**: Send responses back to Chatwoot

## 4. API Specifications

### 4.1 Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

### 4.2 User Management Endpoints
```
GET    /api/users              (Admin only)
POST   /api/users/invite       (Admin only)
PUT    /api/users/:id          (Admin only)
DELETE /api/users/:id          (Admin only)
GET    /api/users/me
```

### 4.3 Agent Management Endpoints
```
GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PUT    /api/agents/:id
DELETE /api/agents/:id
POST   /api/agents/:id/context/upload
POST   /api/agents/:id/context/url
```

### 4.4 Webhook Endpoints
```
POST /webhook/agent/:agentId
```

### 4.5 Settings Endpoints
```
GET /api/settings
PUT /api/settings
```

## 5. Data Models

### 5.1 User Model
```javascript
{
  _id: ObjectId,
  email: String (unique),
  name: String,
  role: String (enum: ['admin', 'user']),
  isActive: Boolean,
  agentAccess: [ObjectId], // Array of agent IDs
  invitedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 5.2 Agent Model
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  prompt: String,
  webhookUrl: String (unique),
  contextDocuments: [{
    type: String (enum: ['file', 'url']),
    content: String,
    filename: String,
    uploadedAt: Date
  }],
  settings: {
    temperature: Number,
    maxTokens: Number,
    responseDelay: Number
  },
  createdBy: ObjectId,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 5.3 Settings Model
```javascript
{
  _id: ObjectId,
  predictionGuard: {
    apiKey: String (encrypted),
    endpoint: String,
    model: String
  },
  server: {
    webhookSecret: String,
    maxFileSize: Number,
    allowedFileTypes: [String]
  },
  updatedBy: ObjectId,
  updatedAt: Date
}
```

## 6. Security Requirements

### 6.1 Authentication Security
- JWT tokens with expiration
- Refresh token rotation
- Rate limiting on auth endpoints
- Password complexity requirements (for initial setup)

### 6.2 API Security
- CORS configuration
- Request validation and sanitization
- File upload restrictions
- Webhook signature verification

### 6.3 Data Security
- Environment variable configuration
- API key encryption at rest
- Secure file storage
- Input sanitization

## 7. Integration Requirements

### 7.1 Chatwoot Integration
- Webhook payload parsing
- Message format compatibility
- Response delivery mechanism
- Error handling and retries

### 7.2 Prediction Guard Integration
- API authentication
- Request/response handling
- Error handling and fallbacks
- Rate limiting compliance

## 8. Performance Requirements

### 8.1 Response Times
- Webhook processing: < 2 seconds
- API responses: < 500ms
- AI response generation: < 10 seconds

### 8.2 Scalability
- Support for 100+ concurrent agents
- Handle 1000+ messages per hour
- Horizontal scaling capability

## 9. Deployment Requirements

### 9.1 Environment Configuration
- Development, staging, and production environments
- Environment-specific configuration
- Docker containerization
- Health check endpoints

### 9.2 Monitoring and Logging
- Application logging
- Error tracking
- Performance monitoring
- Webhook delivery tracking

## 10. Future Enhancements

### 10.1 Phase 2 Features
- Multi-language support
- Advanced analytics dashboard
- Agent performance metrics
- Custom AI model integration

### 10.2 Phase 3 Features
- Multi-tenant architecture
- Advanced workflow automation
- Integration marketplace
- Mobile application support 