#!/bin/bash

# Agent AI Server Deployment Script
# Usage: ./deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
APP_DIR="/opt/agent-ai"
BACKUP_DIR="/opt/backups/agent-ai"

echo "🚀 Starting Agent AI Server Deployment"
echo "Environment: $ENVIRONMENT"
echo "App Directory: $APP_DIR"

# Function to generate secure JWT secrets
generate_jwt_secret() {
    openssl rand -base64 32
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
        
        # Generate secure JWT secrets
        JWT_SECRET=$(generate_jwt_secret)
        JWT_REFRESH_SECRET=$(generate_jwt_secret)
        
        # Update the .env file with generated secrets
        sed -i "s/your-super-secret-jwt-key-change-this-in-production-minimum-32-chars/$JWT_SECRET/" "$APP_DIR/.env"
        sed -i "s/your-super-secret-refresh-key-change-this-in-production-minimum-32-chars/$JWT_REFRESH_SECRET/" "$APP_DIR/.env"
        
        echo "🔑 Generated secure JWT secrets"
        echo "⚠️  IMPORTANT: Please edit $APP_DIR/.env and update:"
        echo "   - PREDICTION_GUARD_API_KEY"
        echo "   - MONGO_ROOT_PASSWORD"
        echo "   - Domain name for SSL certificates"
        echo ""
        read -p "Press Enter to continue after updating .env file..."
    else
        echo "✅ .env file already exists"
    fi
}

# Function to setup SSL certificates
setup_ssl() {
    echo "🔐 Setting up SSL certificates..."
    
    if [ ! -f "$APP_DIR/docker/ssl/cert.pem" ]; then
        echo "📜 SSL certificates not found. Choose an option:"
        echo "1) Generate self-signed certificate (for testing)"
        echo "2) Use Let's Encrypt (requires domain name)"
        echo "3) Skip SSL setup (manual setup required)"
        read -p "Enter choice [1-3]: " ssl_choice
        
        case $ssl_choice in
            1)
                echo "🔨 Generating self-signed certificate..."
                read -p "Enter domain name (or localhost): " domain
                openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                    -keyout "$APP_DIR/docker/ssl/key.pem" \
                    -out "$APP_DIR/docker/ssl/cert.pem" \
                    -subj "/C=US/ST=State/L=City/O=Organization/CN=$domain"
                echo "✅ Self-signed certificate generated"
                ;;
            2)
                read -p "Enter your domain name: " domain
                echo "🌐 Setting up Let's Encrypt for $domain..."
                echo "Make sure your domain points to this server's IP address."
                read -p "Press Enter to continue..."
                
                # Stop any existing web servers
                docker compose down nginx 2>/dev/null || true
                
                # Get certificate
                certbot certonly --standalone -d $domain
                
                # Copy certificates
                cp /etc/letsencrypt/live/$domain/fullchain.pem "$APP_DIR/docker/ssl/cert.pem"
                cp /etc/letsencrypt/live/$domain/privkey.pem "$APP_DIR/docker/ssl/key.pem"
                chown $USER:$USER "$APP_DIR/docker/ssl/"*
                echo "✅ Let's Encrypt certificate installed"
                ;;
            3)
                echo "⚠️  SSL setup skipped. Please manually place cert.pem and key.pem in docker/ssl/"
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
    echo "   Application: https://your-domain.com"
    echo "   Health Check: https://your-domain.com/health"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs: docker compose logs -f"
    echo "   Restart app: docker compose restart app"
    echo "   Stop all: docker compose down"
    echo "   Update app: docker compose up -d --build app"
    echo ""
    echo "📚 For more information, see DEPLOYMENT.md"
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