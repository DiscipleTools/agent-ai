#!/bin/bash

# Agent AI Server Deployment Script
# Usage: ./deploy.sh [environment]
#
# PREREQUISITES:
# 1. Clone the repository to /opt/agent-ai:
#    sudo mkdir -p /opt/agent-ai
#    sudo chown $USER:$USER /opt/agent-ai
#    git clone <your-repo-url> /opt/agent-ai
#    cd /opt/agent-ai
#
# 2. Run this script from the repository directory:
#    ./deploy.sh [production]
#
# This script automates the deployment process described in DEPLOYMENT.md
# For manual deployment instructions, see: DEPLOYMENT.md
# For development setup, see the Quick Start section in README.md

set -e

# Configuration
ENVIRONMENT=${1:-production}
APP_DIR="/opt/agent-ai"
BACKUP_DIR="/opt/backups/agent-ai"

# Global variables for user inputs
DOMAIN_NAME=""
SSL_METHOD=""

echo "🚀 Starting Agent AI Server Deployment"
echo "Environment: $ENVIRONMENT"
echo "App Directory: $APP_DIR"

# Verify we're running from the correct directory
if [ ! -f "docker-compose.yml" ] || [ ! -f "nuxt.config.ts" ]; then
    echo "❌ Error: This script must be run from the agent-ai repository directory"
    echo ""
    echo "Please ensure you have:"
    echo "1. Cloned the repository to $APP_DIR"
    echo "2. Changed to the repository directory: cd $APP_DIR"
    echo "3. Run this script from there: ./deploy.sh"
    echo ""
    echo "Example setup:"
    echo "  sudo mkdir -p $APP_DIR"
    echo "  sudo chown \$USER:\$USER $APP_DIR"
    echo "  git clone <your-repo-url> $APP_DIR"
    echo "  cd $APP_DIR"
    echo "  ./deploy.sh"
    exit 1
fi

# Verify we're in the expected app directory
if [ "$(pwd)" != "$APP_DIR" ]; then
    echo "❌ Error: Script must be run from $APP_DIR"
    echo "Current directory: $(pwd)"
    echo "Expected directory: $APP_DIR"
    echo ""
    echo "Please run: cd $APP_DIR && ./deploy.sh"
    exit 1
fi

# Function to check and install prerequisites
install_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Update package lists first
    echo "📋 Updating package lists..."
    sudo apt update -qq
    
    # Check essential tools
    MISSING_TOOLS=()
    
    # Check curl (needed for Docker installation and health checks)
    if ! command -v curl &> /dev/null; then
        MISSING_TOOLS+=("curl")
    fi
    
    # Check openssl (needed for certificate generation and JWT secrets)
    if ! command -v openssl &> /dev/null; then
        MISSING_TOOLS+=("openssl")
    fi
    
    # Check git (users might need it for updates)
    if ! command -v git &> /dev/null; then
        MISSING_TOOLS+=("git")
    fi
    
    # Check wget (used in health checks)
    if ! command -v wget &> /dev/null; then
        MISSING_TOOLS+=("wget")
    fi
    
    # Check netstat (used for port debugging)
    if ! command -v netstat &> /dev/null; then
        MISSING_TOOLS+=("net-tools")
    fi
    
    # Check sed (used for .env file manipulation)
    if ! command -v sed &> /dev/null; then
        MISSING_TOOLS+=("sed")
    fi
    
    # Install missing essential tools
    if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
        echo "📦 Installing essential tools: ${MISSING_TOOLS[*]}"
        sudo apt install -y "${MISSING_TOOLS[@]}"
        echo "✅ Essential tools installed"
    else
        echo "✅ All essential tools already installed"
    fi
    
    # Check and install certbot (for SSL certificates)
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot for SSL certificates..."
        sudo apt install -y certbot
        echo "✅ Certbot installed"
    else
        echo "✅ Certbot already installed"
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "📦 Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo "✅ Docker installed"
        
        echo "⚠️  Note: You may need to log out and back in for Docker group permissions to take effect"
        echo "      If deployment fails, try running: newgrp docker"
    else
        echo "✅ Docker already installed"
    fi
    
    # Check if Docker Compose is available
    if ! docker compose version &> /dev/null; then
        echo "📦 Installing Docker Compose..."
        sudo apt install -y docker-compose-plugin
        echo "✅ Docker Compose installed"
    else
        echo "✅ Docker Compose already available"
    fi
    
    # Start Docker service if not running
    if ! sudo systemctl is-active --quiet docker; then
        echo "🔄 Starting Docker service..."
        sudo systemctl enable docker
        sudo systemctl start docker
        echo "✅ Docker service started"
    else
        echo "✅ Docker service already running"
    fi
    
    # Check UFW firewall and suggest configuration
    if command -v ufw &> /dev/null; then
        if sudo ufw status | grep -q "Status: active"; then
            echo "🔥 UFW firewall is active"
            if ! sudo ufw status | grep -q "80/tcp\|443/tcp"; then
                echo "⚠️  Firewall may block web traffic. Consider running:"
                echo "      sudo ufw allow 80/tcp"
                echo "      sudo ufw allow 443/tcp"
                echo "      sudo ufw allow ssh"
            else
                echo "✅ Firewall appears to allow web traffic"
            fi
        else
            echo "ℹ️  UFW firewall not active"
        fi
    fi
    
    # Check available disk space
    AVAILABLE_SPACE=$(df /opt | tail -1 | awk '{print $4}')
    if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then  # Less than 2GB
        echo "⚠️  Warning: Less than 2GB free space available"
        echo "      Docker images and data require significant space"
        echo "      Available: $(df -h /opt | tail -1 | awk '{print $4}')"
    else
        echo "✅ Sufficient disk space available"
    fi
}

# Function to get user inputs upfront
get_user_inputs() {
    echo ""
    echo "📋 Configuration Setup"
    echo "We need some information to configure your deployment:"
    echo ""
    
    # Get domain name
    read -p "Enter your domain name (e.g., example.com) or 'localhost' for local testing: " DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        DOMAIN_NAME="localhost"
        echo "Using default: localhost"
    fi
    
    # Validate domain name for Let's Encrypt
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "❌ Error: 'localhost' cannot be used for production deployment"
        echo "   Let's Encrypt requires a valid domain name that points to this server"
        echo "   Please enter a valid domain name (e.g., example.com)"
        exit 1
    fi
    
    # Only Let's Encrypt is supported for production security
    SSL_METHOD="2"
    echo ""
    echo "🔐 SSL Certificate Setup: Let's Encrypt (production-ready)"
    
    echo ""
    echo "📝 Configuration Summary:"
    echo "   Domain: $DOMAIN_NAME"
    echo "   SSL: Let's Encrypt (production-ready)"
    echo ""
}

# Function to generate secure JWT secrets
generate_jwt_secret() {
    openssl rand -base64 32
}

# Function to generate secure password
generate_secure_password() {
    openssl rand -base64 24 | tr -d "=+/" | cut -c1-20
}

# Function to backup data
backup_data() {
    if [ -d "$APP_DIR" ]; then
        echo "📦 Creating backup..."
        mkdir -p $BACKUP_DIR
        docker exec agent-ai-mongodb mongodump --out /data/backup 2>/dev/null || echo "⚠️  MongoDB backup skipped (container not running)"
        docker run --rm -v agent-ai_qdrant_data:/data -v $BACKUP_DIR:/backup ubuntu tar czf /backup/qdrant-backup-$(date +%Y%m%d-%H%M%S).tar.gz /data 2>/dev/null || echo "⚠️  Qdrant backup skipped"
        echo "✅ Backup completed"
    fi
}

# Function to setup environment
setup_environment() {
    echo "🔧 Setting up environment..."
    
    # Debug: Show current directory and file status
    echo "📍 Current directory: $(pwd)"
    echo "📁 App directory: $APP_DIR"
    echo "📄 Checking for .env file at: $APP_DIR/.env"
    
    if [ ! -f "$APP_DIR/.env" ]; then
        echo "📝 Creating .env file from template..."
        
        # Check if template exists
        if [ ! -f "$APP_DIR/env.production.example" ]; then
            echo "❌ Error: Template file not found at $APP_DIR/env.production.example"
            echo "Available files in $APP_DIR:"
            ls -la "$APP_DIR"
            exit 1
        fi
        
        # Copy template
        if ! cp "$APP_DIR/env.production.example" "$APP_DIR/.env"; then
            echo "❌ Error: Failed to copy template file"
            exit 1
        fi
        
        # Verify file was created
        if [ ! -f "$APP_DIR/.env" ]; then
            echo "❌ Error: .env file was not created successfully"
            exit 1
        fi
        
        echo "✅ .env file created from template"
        
        # Generate secure secrets
        echo "🔑 Generating secure secrets..."
        JWT_SECRET=$(generate_jwt_secret)
        JWT_REFRESH_SECRET=$(generate_jwt_secret)
        MONGO_PASSWORD=$(generate_secure_password)
        
        # Debug: Show what we're about to replace
        echo "🔍 Generated secrets (first 8 chars):"
        echo "   JWT_SECRET: ${JWT_SECRET:0:8}..."
        echo "   JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:0:8}..."
        echo "   MONGO_PASSWORD: ${MONGO_PASSWORD:0:8}..."
        echo "   DOMAIN_NAME: $DOMAIN_NAME"
        
        # Update the .env file with generated secrets and domain
        # Using | as delimiter to avoid conflicts with / in base64 encoded secrets
        echo "🔧 Updating .env file with generated values..."
        
        if ! sed -i "s|GENERATE_JWT_SECRET_AUTOMATICALLY|$JWT_SECRET|" "$APP_DIR/.env"; then
            echo "❌ Error: Failed to update JWT_SECRET"
            exit 1
        fi
        
        if ! sed -i "s|GENERATE_JWT_REFRESH_SECRET_AUTOMATICALLY|$JWT_REFRESH_SECRET|" "$APP_DIR/.env"; then
            echo "❌ Error: Failed to update JWT_REFRESH_SECRET"
            exit 1
        fi
        
        if ! sed -i "s|GENERATE_MONGO_PASSWORD_AUTOMATICALLY|$MONGO_PASSWORD|g" "$APP_DIR/.env"; then
            echo "❌ Error: Failed to update MONGO_PASSWORD"
            exit 1
        fi
        
        if ! sed -i "s|your-domain.com|$DOMAIN_NAME|" "$APP_DIR/.env"; then
            echo "❌ Error: Failed to update DOMAIN_NAME"
            exit 1
        fi
        
        # MongoDB URI is already configured with placeholder in template, no need to update
        
        # Verify the replacements worked
        echo "🔍 Verifying replacements..."
        if grep -q "GENERATE_JWT_SECRET_AUTOMATICALLY" "$APP_DIR/.env"; then
            echo "❌ Error: JWT_SECRET was not replaced properly"
            exit 1
        fi
        
        if grep -q "GENERATE_JWT_REFRESH_SECRET_AUTOMATICALLY" "$APP_DIR/.env"; then
            echo "❌ Error: JWT_REFRESH_SECRET was not replaced properly"
            exit 1
        fi
        
        if grep -q "GENERATE_MONGO_PASSWORD_AUTOMATICALLY" "$APP_DIR/.env"; then
            echo "❌ Error: MONGO_PASSWORD was not replaced properly"
            exit 1
        fi
        
        if grep -q "your-domain.com" "$APP_DIR/.env"; then
            echo "❌ Error: DOMAIN_NAME was not replaced properly"
            exit 1
        fi
        
        echo "🔑 Generated secure JWT secrets"
        echo "🔐 Generated secure MongoDB password"
        echo "🌐 Set domain name to: $DOMAIN_NAME"
        echo ""
        
        # Set secure file permissions
        echo "🔒 Setting secure file permissions..."
        chmod 600 "$APP_DIR/.env"
        echo "✅ .env file permissions set to 600 (owner read/write only)"
        
        # Set permissions for SSL directory if it exists
        if [ -d "$APP_DIR/docker/nginx/ssl" ]; then
            chmod 700 "$APP_DIR/docker/nginx/ssl"
            chmod 600 "$APP_DIR/docker/nginx/ssl"/*
            echo "✅ SSL certificate permissions secured"
        fi
        
        echo ""
        echo "📝 AI provider configuration (API keys, endpoints, models) is done through"
        echo "   the Settings interface after deployment is complete."
        echo ""
        echo "✅ Environment configuration completed automatically"
    else
        echo "✅ .env file already exists at: $APP_DIR/.env"
        echo "🔍 File size: $(wc -c < "$APP_DIR/.env") bytes"
        echo "🔍 Last modified: $(stat -c %y "$APP_DIR/.env" 2>/dev/null || stat -f %Sm "$APP_DIR/.env" 2>/dev/null || echo "unknown")"
        
        # Check if the file contains default values that need to be replaced
        if grep -q "GENERATE_JWT_SECRET_AUTOMATICALLY\|GENERATE_JWT_REFRESH_SECRET_AUTOMATICALLY\|GENERATE_MONGO_PASSWORD_AUTOMATICALLY" "$APP_DIR/.env"; then
            echo "⚠️  Warning: .env file contains default values that should be replaced"
            echo "   Consider deleting .env file and re-running this script, or manually update the file"
        fi
    fi
}

# Function to setup SSL certificates
setup_ssl() {
    echo "🔐 Setting up Let's Encrypt SSL certificates..."
    
    if [ ! -f "$APP_DIR/docker/nginx/ssl/cert.pem" ]; then
        echo "🌐 Setting up Let's Encrypt for $DOMAIN_NAME..."
        
        # Verify domain points to this server
        echo "⚠️  IMPORTANT: Make sure your domain points to this server's IP address."
        echo "   You can verify this by running: nslookup $DOMAIN_NAME"
        echo "   The domain must resolve to this server's public IP for Let's Encrypt to work."
        echo ""
        read -p "Press Enter to continue when your domain is pointing to this server..."
        
        # Stop any existing web servers that might use port 80
        echo "🛑 Stopping any services using port 80..."
        docker compose down nginx 2>/dev/null || true
        sudo systemctl stop nginx 2>/dev/null || true
        sudo systemctl stop apache2 2>/dev/null || true
        
        # Ensure port 80 is available
        if netstat -tulpn | grep -q ":80 "; then
            echo "❌ Error: Port 80 is still in use. Let's Encrypt requires port 80 to be available."
            echo "   Please stop all services using port 80 and try again."
            netstat -tulpn | grep ":80 "
            exit 1
        fi
        
        # Get certificate
        echo "🔑 Requesting SSL certificate from Let's Encrypt..."
        if sudo certbot certonly --standalone -d $DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME; then
            # Create SSL directory
            mkdir -p "$APP_DIR/docker/nginx/ssl"
            
            # Copy certificates
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem "$APP_DIR/docker/nginx/ssl/cert.pem"
            sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem "$APP_DIR/docker/nginx/ssl/key.pem"
            sudo chown $USER:$USER "$APP_DIR/docker/nginx/ssl/"*
            echo "✅ Let's Encrypt certificate installed successfully"
            
            # Set up automatic renewal
            echo "🔄 Setting up automatic certificate renewal..."
            (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'docker compose -f $APP_DIR/docker-compose.yml restart nginx'") | sudo crontab -
            echo "✅ Automatic renewal configured"
        else
            echo "❌ Let's Encrypt certificate request failed!"
            echo ""
            echo "Common causes:"
            echo "  - Domain doesn't point to this server's public IP"
            echo "  - Port 80 is blocked by firewall (check: sudo ufw status)"
            echo "  - Another service is using port 80"
            echo "  - Domain DNS hasn't propagated yet (wait 5-10 minutes)"
            echo ""
            echo "Please fix the issue and run the deployment script again."
            exit 1
        fi
    else
        echo "✅ SSL certificates already exist"
        
        # Verify certificate is still valid
        if openssl x509 -checkend 2592000 -noout -in "$APP_DIR/docker/nginx/ssl/cert.pem" 2>/dev/null; then
            echo "✅ Certificate is valid for at least 30 more days"
        else
            echo "⚠️  Certificate expires soon or is invalid. Consider renewal."
        fi
    fi
}

# Function to setup secure logging
setup_secure_logging() {
    echo "📋 Setting up secure logging..."
    
    # Create logs directory with proper permissions
    sudo mkdir -p /var/log/agent-ai
    sudo chown $USER:$USER /var/log/agent-ai
    sudo chmod 750 /var/log/agent-ai
    
    # Create logrotate configuration for nginx logs
    sudo tee /etc/logrotate.d/agent-ai-nginx > /dev/null << 'EOF'
/var/lib/docker/volumes/agent-ai_nginx_logs/_data/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 root root
    postrotate
        docker exec agent-ai-nginx nginx -s reload 2>/dev/null || true
    endscript
}
EOF
    
    echo "✅ Secure logging configuration created"
    echo "   - Log files will be rotated daily"
    echo "   - Logs kept for 14 days"
    echo "   - Log files have restricted permissions (640)"
}

# Function to deploy application
deploy_app() {
    echo "🚢 Deploying application..."
    
    cd "$APP_DIR"
    
    # Test Docker access
    if ! docker ps &>/dev/null; then
        echo "⚠️  Docker permission issue detected. Trying to fix..."
        
        # Try to activate docker group for current session
        if command -v newgrp &>/dev/null; then
            echo "🔄 Activating Docker group permissions..."
            exec newgrp docker ./deploy.sh production
        else
            echo "❌ Docker group permissions not available for current session."
            echo "Please run: sudo usermod -aG docker $USER"
            echo "Then log out and back in, or run: newgrp docker"
            echo "After that, run the deployment script again."
            exit 1
        fi
    fi
    
    # Stop existing services
    echo "🛑 Stopping existing services..."
    docker compose down 2>/dev/null || true
    
    # Build and start services
    echo "🔨 Building and starting services..."
    if ! docker compose up -d --build; then
        echo "❌ Docker Compose failed. Checking for common issues..."
        
        # Check if ports are in use
        echo "📊 Checking port usage..."
        netstat -tulpn | grep -E ":(80|443|3000|27017|6333)" || true
        
        echo ""
        echo "💡 Troubleshooting tips:"
        echo "  1. Make sure no other services are using ports 80, 443, 3000, 27017, 6333"
        echo "  2. Check Docker service status: sudo systemctl status docker"
        echo "  3. Check Docker logs: docker compose logs"
        echo "  4. Try running with sudo if group permissions are still an issue"
        exit 1
    fi
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    # Check service health
    echo "🏥 Checking service health..."
    docker compose ps
    
    # Test health endpoint
    if curl -f -k https://localhost/health &>/dev/null; then
        echo "✅ Application is healthy"
    else
        echo "⚠️  Health check failed, checking logs..."
        docker compose logs --tail=20
    fi
}

# Function to create admin user automatically
setup_admin_user() {
    echo "👤 Setting up admin user..."
    
    # Wait a bit more for database to be fully ready
    echo "⏳ Waiting for database to be ready..."
    sleep 10
    
    # Try to create admin user using temporary container approach
    echo "🔧 Creating admin user with temporary container..."
    
    # Create admin user using a temporary container that shares the network
    ADMIN_OUTPUT=$(docker run --rm \
        --network agent-ai_app-network \
        --env-file "$APP_DIR/.env" \
        -v "$APP_DIR":/app \
        -w /app \
        node:22-alpine \
        sh -c "npm install --silent >/dev/null 2>&1 && npm run create-admin" 2>&1)
    
    ADMIN_EXIT_CODE=$?
    
    if [ $ADMIN_EXIT_CODE -eq 0 ]; then
        if echo "$ADMIN_OUTPUT" | grep -q "Admin user already exists"; then
            echo "ℹ️  Admin user already exists"
            EXISTING_EMAIL=$(echo "$ADMIN_OUTPUT" | grep "Admin user already exists:" | cut -d':' -f2 | tr -d ' ')
            echo "   📧 Email: $EXISTING_EMAIL"
            echo "   🔐 Password: Use existing password or reset if forgotten"
        else
            echo "✅ Admin user created successfully!"
            echo ""
            
            # Extract the generated password from the output
            GENERATED_PASSWORD=$(echo "$ADMIN_OUTPUT" | grep "🔑 Generated Password:" | cut -d':' -f2 | tr -d ' ')
            ADMIN_EMAIL=$(echo "$ADMIN_OUTPUT" | grep "📧 Email:" | cut -d':' -f2 | tr -d ' ')
            
            echo "🔑 ADMIN LOGIN CREDENTIALS:"
            echo "   📧 Email: ${ADMIN_EMAIL:-admin@example.com}"
            echo "   🔐 Password: $GENERATED_PASSWORD"
            echo ""
            echo "⚠️  CRITICAL SECURITY NOTICE:"
            echo "   1. Save these credentials in a secure location NOW"
            echo "   2. You MUST change the password after first login"
            echo "   3. This password will not be shown again"
        fi
        echo ""
    else
        echo "⚠️  Admin user creation failed"
        echo "   Error details:"
        echo "$ADMIN_OUTPUT" | head -5
        echo ""
        echo "   You can create the admin user manually after deployment:"
        echo "   docker run --rm --network agent-ai_app-network --env-file .env -v \$(pwd):/app -w /app node:22-alpine sh -c \"npm install && npm run create-admin\""
        echo ""
        echo "   Or reset the admin password:"
        echo "   docker run --rm --network agent-ai_app-network --env-file .env -v \$(pwd):/app -w /app node:22-alpine sh -c \"npm install && npm run reset-admin-password\""
        echo ""
        echo "   Or if you have Node.js installed locally:"
        echo "   npm run create-admin"
        echo "   npm run reset-admin-password"
        echo ""
    fi
}

# Function to show deployment info
show_info() {
    echo ""
    echo "🎉 Deployment completed!"
    echo ""
    echo "📊 Service Status:"
    docker compose ps
    echo ""
    echo "🔗 Access URLs:"
    if [ "$DOMAIN_NAME" = "localhost" ]; then
        echo "   Application: https://localhost"
        echo "   Health Check: https://localhost/health"
    else
        echo "   Application: https://$DOMAIN_NAME"
        echo "   Health Check: https://$DOMAIN_NAME/health"
    fi
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs: docker compose logs -f"
    echo "   Restart app: docker compose restart app"
    echo "   Stop all: docker compose down"
    echo "   Update app: docker compose up -d --build app"
    echo ""
    echo "🔐 Security Reminders:"
    echo "   - Change the admin password immediately after first login"
    echo "   - Admin password was displayed during deployment (scroll up to find it)"
    echo "   - If you missed the password, you can reset it using the admin interface"
    echo ""
    echo "📚 For more information, see:"
    echo "   - DEPLOYMENT.md for manual deployment instructions"
    echo "   - README.md for development setup and general information"
    echo "   - docker-compose.yml for service configuration"
}

# Main deployment flow
main() {
    # Check if running as root for some operations
    if [ "$EUID" -ne 0 ] && [ "$1" != "--user" ]; then
        echo "⚠️  Some operations may require sudo access"
    fi
    
    # Create app directory if it doesn't exist
    sudo mkdir -p "$APP_DIR"
    sudo chown $USER:$USER "$APP_DIR"
    
    # Change to app directory
    cd "$APP_DIR"
    
    # Install prerequisites
    install_prerequisites
    
    # Get user inputs upfront
    get_user_inputs
    
    # Backup existing data
    backup_data
    
    # Setup environment
    setup_environment
    
    # Setup SSL
    setup_ssl
    
    # Setup secure logging
    setup_secure_logging
    
    # Deploy application
    deploy_app
    
    # Setup admin user
    setup_admin_user
    
    # Show deployment info
    show_info
}

# Run main function
main "$@" 