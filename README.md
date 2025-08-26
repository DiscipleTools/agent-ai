# Agent AI Server

A full-stack Nuxt.js application for managing AI agents that integrate with Chatwoot instances. This system enables organizations to deploy multiple AI agents that can automatically respond to customer inquiries via chat and email using Prediction Guard's secure AI models.


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

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key  # Used for CSRF token signing only

# Chatwoot Integration (optional)
CHATWOOT_URL=https://your-chatwoot-instance.com
CHATWOOT_API_TOKEN=your-chatwoot-api-token

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

#### Main Application
```bash
npm run dev
```

#### RAG Service (Vector Database)
For agents to use context from documents, you need Qdrant vector database running. The embedding model will automatically load when the server starts.

**🎯 Quick Setup (Recommended for Development)**

1. **Download and run Qdrant binary:**
```bash
# Download Qdrant for macOS
curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-apple-darwin.tar.gz -o qdrant.tar.gz

# Extract and run
tar -xzf qdrant.tar.gz
chmod +x qdrant
./qdrant &
```

2. **Verify Qdrant is running:**
```bash
curl http://localhost:6333/collections
# Should return: {"result":{"collections":[]},"status":"ok","time":...}
```

**💡 Managing Qdrant Process**
```bash
# Check if Qdrant is running
ps aux | grep qdrant | grep -v grep

# Stop Qdrant (find process ID first)
kill $(ps aux | grep "./qdrant" | grep -v grep | awk '{print $2}')

# Restart Qdrant
./qdrant &
```

**🐳 Alternative: Docker Options**

**Option A: Using Docker directly**
```bash
docker run -d \
  --name agent-ai-qdrant \
  -p 6333:6333 \
  -v qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```

**Option B: Using Docker Compose (if available)**
```bash
# Start the Qdrant vector database
docker compose up -d qdrant
```

**🔧 Environment Configuration**

Make sure your `.env` file includes:
```env
QDRANT_URL=http://localhost:6333
```

**✅ Verify Setup**

1. **Check Qdrant:** `curl http://localhost:6333/collections`
2. **Check your server:** `curl http://localhost:3000/api/health`
3. **Check embedding model:** Visit Settings page in your dashboard - it should show "Embedding Model: Loaded"

**🚀 Complete Verification Script**
```bash
echo "🔍 Checking Qdrant..."
curl -s http://localhost:6333/collections && echo " ✅ Qdrant is running"

echo "🔍 Checking server..."
curl -s http://localhost:3000/api/health && echo " ✅ Server is running"

echo "🔍 Checking processes..."
ps aux | grep -E "(qdrant|npm run dev)" | grep -v grep
```

**📊 What Happens During Startup**

When you start your development server (`npm run dev`), you'll see:
```
✅ MongoDB Connected: localhost
Embedding model not loaded, attempting initialization...
Loading multilingual embedding model...
✅ Multilingual embedding model loaded successfully
```

The embedding model (`Xenova/all-MiniLM-L12-v2`) downloads automatically (~100MB) on first use and is cached locally.

**🔧 Troubleshooting RAG Setup**

| Issue | Solution |
|-------|----------|
| **"Embedding model failed to load"** | Ensure you have at least 500MB free disk space and stable internet connection for the initial model download |
| **"Qdrant not connected"** | Check if Qdrant is running: `curl http://localhost:6333/collections` |
| **"No process running on port 6333"** | Start Qdrant using one of the methods above |
| **Model downloads slowly** | First-time setup downloads ~100MB. Subsequent startups are fast as the model is cached |
| **"Cannot connect to Qdrant"** | Verify `QDRANT_URL=http://localhost:6333` is in your `.env` file |

For more detailed troubleshooting, see [RAG_SETUP.md](./RAG_SETUP.md).

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
- **Create admin user automatically with default credentials**
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

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.