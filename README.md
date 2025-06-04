# Agent AI Server

A full-stack Nuxt.js application for managing AI agents that integrate with Chatwoot instances. This system enables organizations to deploy multiple AI agents that can automatically respond to customer inquiries via chat and email using Prediction Guard's secure AI models.

## 🚀 Features

- **Full-Stack Nuxt.js Application**: Frontend and backend in one unified application
- **AI Agent Management**: Create, configure, and manage multiple AI agents
- **Chatwoot Integration**: Seamless webhook integration with Chatwoot instances
- **User Authentication**: JWT-based authentication with role-based access control
- **Admin Dashboard**: Complete admin interface for user and agent management
- **AI-Powered Responses**: Integration with Prediction Guard API for intelligent, secure responses
- **Modern UI**: Beautiful, responsive interface built with Vue 3 + Tailwind CSS
- **Context-Aware Agents**: Support for file uploads, URL content, and full website scraping
- **Website Crawling**: Automatically crawl entire websites to extract comprehensive content for agent context
- **Real-time Testing**: Built-in AI connection testing and model selection

## 🛠️ Technology Stack

- **Frontend**: Nuxt.js 3, Vue 3, Tailwind CSS, Pinia
- **Backend**: Nuxt.js Server API, Node.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with refresh token rotation
- **AI Integration**: Prediction Guard API with multiple model support
- **Validation**: VeeValidate for form validation

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 4.4+
- npm or yarn
- Prediction Guard API key (for AI functionality)

## 🚀 Quick Start (Development)

> ⚠️ **Note**: This Quick Start guide is for **development environment only**. For production deployment, see the [Production Deployment](#-production-deployment) section below.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd agent-ai-server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy the environment template
cp env.example .env

# Edit the .env file with your configuration
nano .env
```

Required environment variables:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/agent-ai-server

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Prediction Guard AI Configuration
PREDICTION_GUARD_API_KEY=your-prediction-guard-api-key
PREDICTION_GUARD_ENDPOINT=https://api.predictionguard.com
PREDICTION_GUARD_DEFAULT_MODEL=Hermes-3-Llama-3.1-8B

# Chatwoot Integration (optional)
CHATWOOT_URL=https://your-chatwoot-instance.com
CHATWOOT_API_TOKEN=your-chatwoot-api-token

# Application
APP_NAME=Agent AI Server
NODE_ENV=development
```

### 4. Get Prediction Guard API Key

1. Sign up at [predictionguard.com](https://predictionguard.com)
2. Get your API key from the dashboard
3. Add it to your `.env` file **OR** configure it through the Settings interface after starting the server

**Note**: You can configure Prediction Guard settings either through environment variables or through the admin Settings interface in the dashboard. Database settings take priority over environment variables.

### 5. Create Admin User
```bash
npm run create-admin
```

This will create an admin user with:
- **Email**: admin@example.com
- **Password**: AdminPassword123
- **Role**: admin

### 6. Start the Development Server
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api

### 7. Test AI Integration

1. Log in to the dashboard
2. Go to Settings
3. Click "Test AI Connection" to verify Prediction Guard setup

## 🏭 Production Deployment

For production deployment, you have two options:

### Option A: Automated Deployment (Recommended)

Use the automated deployment script for the easiest setup:

```bash
# Step 1: Clone repository to the required production directory
sudo mkdir -p /opt/agent-ai
sudo chown $USER:$USER /opt/agent-ai
git clone <repository-url> /opt/agent-ai
cd /opt/agent-ai

# Step 2: Make deployment script executable and run it
chmod +x deploy.sh
./deploy.sh production
```

**⚠️ Important**: The repository **must** be cloned to `/opt/agent-ai` for the deployment script to work correctly. The script expects this specific directory structure and will validate the location before proceeding.

The deployment script will automatically:
- Create backups of existing data
- Setup environment from production template
- Generate secure JWT secrets
- Configure SSL certificates (Let's Encrypt or self-signed)
- Deploy using Docker Compose with MongoDB, Qdrant, and Nginx
- Display access information and management commands

### Option B: Manual Docker Deployment

For more control over the deployment process, follow the detailed step-by-step guide:

**📖 See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete manual deployment instructions**

This includes:
- Server setup and prerequisites
- Repository cloning to the correct location (`/opt/agent-ai`)
- SSL certificate configuration
- Docker Compose service management
- Monitoring and maintenance procedures
- Troubleshooting common issues

### Quick Production Setup

If you prefer a minimal Docker setup:

```bash
# Clone to the required directory
git clone <repository-url> /opt/agent-ai
cd /opt/agent-ai

# Copy production environment template
cp env.production.example .env

# Edit production configuration
nano .env

# Deploy with Docker Compose
docker compose up -d
```

**Important**: 
1. **Repository Location**: Must be cloned to `/opt/agent-ai` - this is where Docker Compose expects to find the application files
2. **Environment Variables**: Update these values in `.env` before deployment:
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate secure 32+ character secrets)
   - `PREDICTION_GUARD_API_KEY` (your actual API key)
   - `MONGO_ROOT_PASSWORD` (strong database password)

### Production URLs

After deployment, your application will be available at:
- **Application**: https://your-domain.com
- **Health Check**: https://your-domain.com/health
- **API**: https://your-domain.com/api

## 🤖 AI Integration with Prediction Guard

### Available Models

| Model | Type | Use Case | Context Length |
|-------|------|----------|----------------|
| Hermes-3-Llama-3.1-70B | Chat | Advanced reasoning, complex tasks | 20,480 |
| Hermes-3-Llama-3.1-8B | Chat | General conversation, fast responses | 20,480 |
| DeepSeek-R1-Distill-Qwen-32B | Reasoning | Complex problem solving | 20,480 |
| Qwen2.5-Coder-14B-Instruct | Code | Programming assistance | 8,192 |
| neural-chat-7b-v3-3 | Chat | Basic conversation | 8,192 |

### Security Features

- **No Data Storage**: Prediction Guard doesn't store your conversations
- **No Training**: Your data isn't used for model training
- **Built-in Safety**: Automatic content filtering and safety checks
- **Secure Transit**: All requests encrypted with HTTPS

### Configuration Options

Each agent can be configured with:
- **Temperature**: Controls response creativity (0.0-1.0)
- **Max Tokens**: Maximum response length (1-2000)
- **Response Delay**: Delay before responding (0-30 seconds)
- **Context Documents**: File uploads, URL content, and full website crawling for enhanced responses

### Website Scraping
The platform now supports crawling entire websites to provide comprehensive context:
- **Multi-page crawling**: Automatically discover and scrape multiple pages
- **Configurable options**: Control depth (1-3 levels), page limits (1-50), and domain filtering
- **Robots.txt compliance**: Respects website crawling permissions
- **Smart filtering**: Excludes admin pages, media files, and irrelevant content
- **Re-crawling**: Update website content to keep context current

For detailed information, see [WEBSITE_SCRAPING.md](./WEBSITE_SCRAPING.md).

## 📁 Project Structure

```
agent-ai-server/
├── components/           # Vue components
├── layouts/             # Nuxt layouts
├── pages/               # Application pages
├── server/              # Server-side API
│   ├── api/            # API routes
│   ├── models/         # Database models
│   ├── services/       # Business logic services
│   └── utils/          # Utility functions
├── stores/              # Pinia stores
├── middleware/          # Route middleware
├── assets/              # Static assets
├── scripts/             # Utility scripts
├── public/              # Public static files
├── old-backend/         # Backup of original backend
└── nuxt.config.ts       # Nuxt configuration
```

## 🔐 Authentication

The application uses JWT-based authentication with:
- **Access tokens**: Short-lived (1 hour) for API access
- **Refresh tokens**: Long-lived (7 days) for token renewal
- **Role-based access**: Admin and user roles
- **Secure cookies**: HTTP-only cookies for token storage

### Default Admin Credentials
- **Email**: admin@example.com
- **Password**: AdminPassword123

⚠️ **Important**: Change the default password after first login!

## 🤖 Agent Management

### Creating an Agent
1. Log in to the dashboard
2. Navigate to "Agents" section
3. Click "Create Agent"
4. Configure:
   - Name and description
   - System prompt
   - AI settings (temperature, max tokens, response delay)
   - Context documents (files/URLs)

### Webhook Integration
Each agent gets a unique webhook URL for Chatwoot integration:
```
POST /webhook/agent/{agentId}
```

## 👥 User Management (Admin Only)

Admins can:
- Invite new users
- Assign agent access permissions
- Edit user roles
- Deactivate users

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Agents
- `GET /api/agents` - List agents
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get agent details
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users/invite` - Invite user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🚀 Deployment

### Development Build
```bash
npm run build
npm run preview
```

### Production Deployment

For production deployment, see the [Production Deployment](#-production-deployment) section above, which covers:

- **Automated deployment** with `deploy.sh` script
- **Manual deployment** following [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Docker Compose** setup with all required services

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/agent-ai-server
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
PREDICTION_GUARD_API_KEY=your-production-api-key
```

For complete production environment configuration, see `env.production.example`.

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run create-admin # Create admin user
npm run setup        # Run setup script
```

### Database Scripts
```bash
# Create admin user
node scripts/createAdmin.js [email] [name] [password]

# Debug user (development only)
node scripts/debugUser.js
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify database permissions

2. **Authentication Issues**
   - Clear browser cookies
   - Check JWT secrets in .env
   - Verify admin user exists

3. **Port Conflicts**
   - Default port is 3000
   - Use `PORT=3001 npm run dev` to change port

### Logs
Application logs are available in the console during development.

## 📄 Documentation

- [Production Deployment Guide](DEPLOYMENT.md) - Complete manual deployment instructions
- [Project Specification](PROJECT_SPECIFICATION.md)
- [Implementation Guide](IMPLEMENTATION_GUIDE.md)
- [Frontend Implementation](FRONTEND_IMPLEMENTATION.md)
- [Website Scraping Guide](WEBSITE_SCRAPING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation files
- Review the troubleshooting section
- Create an issue in the repository
