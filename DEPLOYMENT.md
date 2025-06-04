# Production Deployment Guide

This guide covers deploying the Agent AI Server application to a DigitalOcean droplet using Docker Compose.

## Prerequisites

- DigitalOcean droplet (Ubuntu 22.04 LTS recommended)
- Docker and Docker Compose installed
- Domain name pointed to your droplet's IP address
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

### 2. Upload Application Code

Upload your application code to `/opt/agent-ai` using git, rsync, or scp:

```bash
# Option 1: Git (recommended)
git clone <your-repo-url> .

# Option 2: Upload via rsync
rsync -avz --exclude node_modules ./ user@your-server:/opt/agent-ai/
```

### 3. Environment Configuration

```bash
# Copy and edit environment file
cp env.production.example .env
nano .env
```

**Important**: Update these values in `.env`:
- `JWT_SECRET` - Generate a secure 32+ character secret
- `JWT_REFRESH_SECRET` - Generate another secure 32+ character secret
- `MONGO_ROOT_PASSWORD` - Set a strong MongoDB password
- `PREDICTION_GUARD_API_KEY` - Your actual API key

### 4. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to Docker volume
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem
sudo chown $USER:$USER docker/ssl/*
```

#### Option B: Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout docker/ssl/key.pem \
    -out docker/ssl/cert.pem \
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
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem

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
sudo chown $USER:$USER docker/ssl/*
sudo chmod 644 docker/ssl/cert.pem
sudo chmod 600 docker/ssl/key.pem
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

1. **Resource Limits**: Consider adding resource limits to Docker services based on your droplet size
2. **Database Indexes**: The MongoDB init script creates optimal indexes
3. **Nginx Caching**: Static files are cached for 1 year
4. **Gzip Compression**: Enabled for all text-based content

## Scaling Considerations

For higher traffic, consider:
1. Using DigitalOcean's managed MongoDB service
2. Using Qdrant Cloud for the vector database
3. Adding load balancing with multiple app instances
4. Using a CDN for static assets

## Environment Variables Reference

See `env.production.example` for all available environment variables and their descriptions. 