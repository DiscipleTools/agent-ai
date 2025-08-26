# Production Deployment Guide

This guide covers deploying the Agent AI Server application to any cloud server using Docker Compose.

> 💡 **Quick Start**: For automated deployment, use the `deploy.sh` script instead:
> ```bash
> # 1. First clone the repository to /opt/agent-ai
> sudo mkdir -p /opt/agent-ai
> git clone <your-repo-url> /opt/agent-ai
> sudo chown $USER:$USER /opt/agent-ai
> cd /opt/agent-ai
> 
> # 2. Run the automated deployment script
> ./deploy.sh production
> ```
> This script automates all the steps described in this guide, including:
> - Interactive domain name configuration
> - Automatic SSL certificate setup (Let's Encrypt or self-signed)
> - Secure password and secret generation
> - Complete environment configuration
> - **Automatic admin user creation**
>
> For development setup, see the [Quick Start section in README.md](README.md#-quick-start-development).

## Prerequisites

- Linux server (Ubuntu 22.04 LTS recommended)
- Docker and Docker Compose installed
- Domain name pointed to your server's IP address
- SSL certificate (Let's Encrypt recommended)

## Server Setup

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Create application directory
mkdir -p /opt/agent-ai
cd /opt/agent-ai
```

### 2. Clone and Setup Application Code

**Important**: The application must be cloned to `/opt/agent-ai` for the deployment to work correctly.

```bash
# Create the application directory
sudo mkdir -p /opt/agent-ai
sudo chown $USER:$USER /opt/agent-ai

# Clone the repository to the correct location
git clone <your-repo-url> /opt/agent-ai

# Change to the application directory
cd /opt/agent-ai

# Verify you're in the correct location with the right files
ls -la
# You should see: docker-compose.yml, nuxt.config.ts, package.json, etc.
```

**Alternative upload methods** (if not using git):

```bash
# Option 2: Upload via rsync (from your local machine)
rsync -avz --exclude node_modules ./ user@your-server:/opt/agent-ai/

# Option 3: Upload via scp (from your local machine)
scp -r ./ user@your-server:/opt/agent-ai/
```

**⚠️ Critical**: All subsequent commands in this guide assume you are in `/opt/agent-ai`. The Docker Compose configuration and deployment scripts expect this directory structure.

### 3. Environment Configuration

```bash
# Copy and edit environment file
cp env.production.example .env
nano .env
```

**Important**: Update these values in `.env`:
- `JWT_SECRET` - Generate a secure 32+ character secret (used for CSRF token signing only)
- `MONGO_ROOT_PASSWORD` - Set a strong MongoDB password

**Note**: User authentication is handled through Chatwoot sessions, not JWT tokens.

**Note**: AI provider configuration (API keys, endpoints, models) is now handled through the Settings interface in the application dashboard. No environment variables are required for AI configuration.

### 4. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to Docker volume
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem
sudo chown $USER:$USER docker/nginx/ssl/*
```

#### Option B: Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout docker/nginx/ssl/key.pem \
    -out docker/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

### 5. Deploy Application

```bash
# Build and start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f app
```

## Service Management

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart app container
docker compose up -d --build app

# Or restart all services
docker compose down && docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f mongodb
docker compose logs -f qdrant
docker compose logs -f nginx
```

## Monitoring and Maintenance

### Health Checks

The setup includes health checks for all services:
- App: `http://your-domain.com/health`
- MongoDB: Internal MongoDB ping
- Qdrant: `http://localhost:6333/health`
- Nginx: HTTP response check

### Backups

#### MongoDB Backup
```bash
# Create backup
docker exec agent-ai-mongodb mongodump --out /data/backup

# Restore backup
docker exec agent-ai-mongodb mongorestore /data/backup
```

#### Qdrant Backup
```bash
# Qdrant data is stored in the qdrant_data volume
docker run --rm -v agent-ai_qdrant_data:/data -v $(pwd):/backup ubuntu tar czf /backup/qdrant-backup.tar.gz /data
```

### SSL Certificate Renewal

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem

# Restart nginx to load new certificates
docker compose restart nginx
```

## Security Considerations

1. **Firewall Configuration**:
```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **MongoDB Security**:
   - Uses authentication by default
   - Only accessible from within Docker network

3. **Rate Limiting**:
   - Nginx includes rate limiting for API endpoints
   - Login endpoint has stricter limits

4. **SSL/TLS**:
   - Forces HTTPS redirect
   - Modern TLS configuration
   - Security headers included

## Troubleshooting

### Common Issues

1. **Permission Denied for SSL files**:
```bash
sudo chown $USER:$USER docker/nginx/ssl/*
sudo chmod 644 docker/nginx/ssl/cert.pem
sudo chmod 600 docker/nginx/ssl/key.pem
```

2. **MongoDB Connection Issues**:
```bash
# Check MongoDB logs
docker compose logs mongodb

# Verify connection from app container
docker exec agent-ai-app wget -qO- http://mongodb:27017
```

3. **Qdrant Connection Issues**:
```bash
# Check Qdrant health
docker exec agent-ai-qdrant curl -f http://localhost:6333/health

# Check from app container
docker exec agent-ai-app wget -qO- http://qdrant:6333/health
```

4. **Nginx Configuration Issues**:
```bash
# Test nginx configuration
docker exec agent-ai-nginx nginx -t

# Reload nginx configuration
docker compose restart nginx
```

### Logs and Debugging

```bash
# Check all service logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Check specific service
docker compose logs app

# Check Docker system information
docker system df
docker system prune -f  # Clean up unused resources
```

## Performance Optimization

1. **Resource Limits**: Consider adding resource limits to Docker services based on your server size
2. **Database Indexes**: The MongoDB init script creates optimal indexes
3. **Nginx Caching**: Static files are cached for 1 year
4. **Gzip Compression**: Enabled for all text-based content

## Scaling Considerations

For higher traffic, consider:
1. Using managed database services (MongoDB Atlas, etc.)
2. Using Qdrant Cloud for the vector database
3. Adding load balancing with multiple app instances
4. Using a CDN for static assets

## Environment Variables Reference

See `env.production.example` for all available environment variables and their descriptions.

## Automated Deployment Alternative

Instead of following this manual guide, you can use the automated deployment script:

```bash
./deploy.sh production
```

The script performs all the steps described in this guide automatically, including:
- Interactive domain name and SSL configuration
- Environment setup and secure secret generation
- SSL certificate configuration (Let's Encrypt or self-signed)
- Docker Compose deployment
- Service health checks
- Backup creation
- **Automatic admin user creation**

The script will prompt you for:
- Your domain name (or localhost for local testing)
- SSL certificate method (Let's Encrypt, self-signed, or manual setup)

All other configuration is handled automatically with secure defaults.

### Admin User Creation

The deployment script automatically creates an admin user with these default credentials:
- **Email:** `admin@example.com`
- **Password:** `AdminPassword123`
- **Role:** `admin` (full system access)

⚠️ **Important**: Change the password immediately after first login for security!

If automatic admin creation fails, you can create the user manually:

```bash
# Using temporary container (recommended)
docker run --rm --network agent-ai_app-network --env-file .env -v $(pwd):/app -w /app node:22-alpine sh -c "npm install && npm run create-admin"

# Using host machine (if Node.js available)
npm run create-admin
```

For more deployment options, see [README.md](README.md#-production-deployment). 