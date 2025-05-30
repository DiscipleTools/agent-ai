# Agent AI Server

A full-stack Nuxt.js application for managing AI agents that integrate with Chatwoot instances. This system enables organizations to deploy multiple AI agents that can automatically respond to customer inquiries via chat and email.

## 🚀 Features

- **Full-Stack Nuxt.js Application**: Frontend and backend in one unified application
- **AI Agent Management**: Create, configure, and manage multiple AI agents
- **Chatwoot Integration**: Seamless webhook integration with Chatwoot instances
- **User Authentication**: JWT-based authentication with role-based access control
- **Admin Dashboard**: Complete admin interface for user and agent management
- **AI-Powered Responses**: Integration with Prediction Guard API for intelligent responses
- **Modern UI**: Beautiful, responsive interface built with Vue 3 + Tailwind CSS

## 🛠️ Technology Stack

- **Frontend**: Nuxt.js 3, Vue 3, Tailwind CSS, Pinia
- **Backend**: Nuxt.js Server API, Node.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with refresh token rotation
- **AI Integration**: Prediction Guard API
- **Validation**: VeeValidate for form validation

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 4.4+
- npm or yarn

## 🚀 Quick Start

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

# Prediction Guard API (optional for development)
PREDICTION_GUARD_API_KEY=your-prediction-guard-api-key

# Application
APP_NAME=Agent AI Server
NODE_ENV=development
```

### 4. Create Admin User
```bash
npm run create-admin
```

This will create an admin user with:
- **Email**: admin@example.com
- **Password**: AdminPassword123
- **Role**: admin

### 5. Start the Development Server
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api

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

### Production Build
```bash
npm run build
npm run preview
```

### Docker Deployment
```bash
# Build the image
docker build -t agent-ai-server .

# Run the container
docker run -p 3000:3000 -e MONGODB_URI=your-mongo-uri agent-ai-server
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db/agent-ai-server
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
PREDICTION_GUARD_API_KEY=your-production-api-key
```

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

## 📚 Documentation

- [Project Specification](PROJECT_SPECIFICATION.md)
- [Implementation Guide](IMPLEMENTATION_GUIDE.md)
- [Frontend Implementation](FRONTEND_IMPLEMENTATION.md)

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
