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
    
    # Get SSL method
    echo ""
    echo "🔐 SSL Certificate Setup:"
    echo "1) Generate self-signed certificate (for testing/development)"
    echo "2) Use Let's Encrypt (for production with valid domain)"
    echo "3) Skip SSL setup (manual setup required later)"
    read -p "Choose SSL method [1-3]: " SSL_METHOD
    
    if [ -z "$SSL_METHOD" ]; then
        SSL_METHOD="1"
        echo "Using default: Self-signed certificate"
    fi
    
    echo ""
    echo "📝 Configuration Summary:"
    echo "   Domain: $DOMAIN_NAME"
    case $SSL_METHOD in
        1) echo "   SSL: Self-signed certificate" ;;
        2) echo "   SSL: Let's Encrypt" ;;
        3) echo "   SSL: Manual setup" ;;
    esac
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
    
    if [ ! -f "$APP_DIR/.env" ]; then
        echo "📝 Creating .env file from template..."
        cp "$APP_DIR/env.production.example" "$APP_DIR/.env"
        
        # Generate secure secrets
        JWT_SECRET=$(generate_jwt_secret)
        JWT_REFRESH_SECRET=$(generate_jwt_secret)
        MONGO_PASSWORD=$(generate_secure_password)
        
        # Update the .env file with generated secrets and domain
        sed -i "s/your-super-secret-jwt-key-change-this-in-production-minimum-32-chars/$JWT_SECRET/" "$APP_DIR/.env"
        sed -i "s/your-super-secret-refresh-key-change-this-in-production-minimum-32-chars/$JWT_REFRESH_SECRET/" "$APP_DIR/.env"
        sed -i "s/change-this-secure-password/$MONGO_PASSWORD/" "$APP_DIR/.env"
        sed -i "s/your-domain.com/$DOMAIN_NAME/" "$APP_DIR/.env"
        
        echo "🔑 Generated secure JWT secrets"
        echo "🔐 Generated secure MongoDB password"
        echo "🌐 Set domain name to: $DOMAIN_NAME"
        echo ""
        echo "📝 AI provider configuration (API keys, endpoints, models) is done through"
        echo "   the Settings interface after deployment is complete."
        echo ""
        echo "✅ Environment configuration completed automatically"
    else
        echo "✅ .env file already exists"
    fi
}

# Function to setup SSL certificates
setup_ssl() {
    echo "🔐 Setting up SSL certificates..."
    
    if [ ! -f "$APP_DIR/docker/ssl/cert.pem" ]; then
        case $SSL_METHOD in
            1)
                echo "🔨 Generating self-signed certificate for $DOMAIN_NAME..."
                mkdir -p "$APP_DIR/docker/ssl"
                openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                    -keyout "$APP_DIR/docker/ssl/key.pem" \
                    -out "$APP_DIR/docker/ssl/cert.pem" \
                    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_NAME"
                echo "✅ Self-signed certificate generated"
                ;;
            2)
                echo "🌐 Setting up Let's Encrypt for $DOMAIN_NAME..."
                
                # Check if certbot is installed
                if ! command -v certbot &> /dev/null; then
                    echo "📦 Installing certbot..."
                    sudo apt update
                    sudo apt install -y certbot
                fi
                
                echo "Make sure your domain points to this server's IP address."
                echo "You can verify this by running: nslookup $DOMAIN_NAME"
                read -p "Press Enter to continue when your domain is pointing to this server..."
                
                # Stop any existing web servers that might use port 80
                docker compose down nginx 2>/dev/null || true
                sudo systemctl stop nginx 2>/dev/null || true
                sudo systemctl stop apache2 2>/dev/null || true
                
                # Get certificate
                echo "🔑 Requesting SSL certificate from Let's Encrypt..."
                if sudo certbot certonly --standalone -d $DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME; then
                    # Create SSL directory
                    mkdir -p "$APP_DIR/docker/ssl"
                    
                    # Copy certificates
                    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem "$APP_DIR/docker/ssl/cert.pem"
                    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem "$APP_DIR/docker/ssl/key.pem"
                    sudo chown $USER:$USER "$APP_DIR/docker/ssl/"*
                    echo "✅ Let's Encrypt certificate installed"
                else
                    echo "❌ Let's Encrypt certificate request failed!"
                    echo "This could be because:"
                    echo "  - Domain doesn't point to this server"
                    echo "  - Port 80 is blocked by firewall"
                    echo "  - Another service is using port 80"
                    echo ""
                    echo "Falling back to self-signed certificate..."
                    mkdir -p "$APP_DIR/docker/ssl"
                    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                        -keyout "$APP_DIR/docker/ssl/key.pem" \
                        -out "$APP_DIR/docker/ssl/cert.pem" \
                        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_NAME"
                    echo "✅ Self-signed certificate generated as fallback"
                fi
                ;;
            3)
                echo "⚠️  SSL setup skipped. Please manually place cert.pem and key.pem in docker/ssl/"
                mkdir -p "$APP_DIR/docker/ssl"
                ;;
        esac
    else
        echo "✅ SSL certificates already exist"
    fi
}

# Function to deploy application
deploy_app() {
    echo "🚢 Deploying application..."
    
    cd "$APP_DIR"
    
    # Stop existing services
    docker compose down
    
    # Build and start services
    docker compose up -d --build
    
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
    
    # Get user inputs upfront
    get_user_inputs
    
    # Backup existing data
    backup_data
    
    # Setup environment
    setup_environment
    
    # Setup SSL
    setup_ssl
    
    # Deploy application
    deploy_app
    
    # Show deployment info
    show_info
}

# Run main function
main "$@" 