#!/bin/bash

# SSL Certificate Renewal Script for Agent AI Server
# This script renews Let's Encrypt certificates and restarts nginx

set -e

APP_DIR="/opt/agent-ai"
DOMAIN_NAME=$(grep "DOMAIN_NAME=" "$APP_DIR/.env" | cut -d'=' -f2)

echo "🔄 Renewing SSL certificate for $DOMAIN_NAME..."

# Stop nginx to free port 80
cd "$APP_DIR"
docker compose stop nginx

# Renew certificate
if sudo certbot renew --standalone --quiet; then
    echo "✅ Certificate renewed successfully"
    
    # Copy new certificates
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem "$APP_DIR/docker/nginx/ssl/cert.pem"
    sudo cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem "$APP_DIR/docker/nginx/ssl/key.pem"
    sudo chown $USER:$USER "$APP_DIR/docker/nginx/ssl/"*
    
    # Restart nginx
    docker compose start nginx
    echo "✅ Nginx restarted with new certificate"
else
    echo "❌ Certificate renewal failed"
    # Start nginx anyway to maintain service
    docker compose start nginx
    exit 1
fi

echo "🎉 SSL certificate renewal completed successfully" 