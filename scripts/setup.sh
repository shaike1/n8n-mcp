#!/bin/bash

# N8N MCP Server Setup Script

set -e

echo "🚀 Setting up N8N MCP Server..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before proceeding."
    echo "   Most importantly, set your DOMAIN and N8N_API_KEY."
fi

# Check if user has existing Traefik
echo "🔍 Checking for existing Traefik instance..."
USE_EXISTING_TRAEFIK=false

if docker ps --format "table {{.Names}}" | grep -q traefik; then
    echo "✅ Found running Traefik container."
    USE_EXISTING_TRAEFIK=true
elif docker network ls | grep -q traefik; then
    echo "✅ Found existing Traefik network."
    USE_EXISTING_TRAEFIK=true
else
    echo "❓ No existing Traefik found."
    read -p "Do you have an existing Traefik instance? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        USE_EXISTING_TRAEFIK=true
    fi
fi

# Setup based on Traefik availability
if [ "$USE_EXISTING_TRAEFIK" = true ]; then
    echo "🔗 Using existing Traefik instance..."
    
    # Ensure Traefik network exists
    if ! docker network ls | grep -q traefik; then
        echo "🌐 Creating Traefik network..."
        docker network create traefik
    fi
    
    # Use standalone docker-compose
    COMPOSE_FILE="docker-compose.standalone.yml"
    
    echo "📋 Using standalone configuration (no Traefik service)"
    echo "⚠️  Make sure your existing Traefik can access the 'traefik' network"
    
else
    echo "🚀 Setting up with included Traefik service..."
    
    # Create Traefik network
    if ! docker network ls | grep -q traefik; then
        echo "🌐 Creating Traefik network..."
        docker network create traefik
    fi
    
    # Create necessary directories for Traefik
    mkdir -p traefik/logs
    mkdir -p traefik/letsencrypt
    
    # Set proper permissions for Traefik
    echo "🔒 Setting up Traefik permissions..."
    touch traefik/letsencrypt/acme.json
    chmod 600 traefik/letsencrypt/acme.json
    
    COMPOSE_FILE="docker-compose.yml"
fi

# Build the MCP server image
echo "🔨 Building N8N MCP Server image..."
docker-compose -f "$COMPOSE_FILE" build

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your DOMAIN and N8N configuration"

if [ "$USE_EXISTING_TRAEFIK" = true ]; then
    echo "2. Start N8N MCP Server: docker-compose -f docker-compose.standalone.yml up -d"
    echo ""
    echo "🔧 Traefik Labels Applied:"
    echo "   - Host: n8n-mcp.\${DOMAIN}"
    echo "   - N8N Host: n8n.\${DOMAIN}"
    echo "   - Network: traefik"
    echo ""
    echo "⚠️  Ensure your existing Traefik:"
    echo "   - Has access to 'traefik' network"
    echo "   - Has SSL/TLS certificate resolver configured"
    echo "   - Can route to the configured domains"
else
    echo "2. Start Traefik: docker-compose -f traefik/docker-compose.traefik.yml up -d"
    echo "3. Start N8N MCP Server: docker-compose up -d"
    echo ""
    echo "🔗 Traefik Dashboard: http://traefik.\${DOMAIN}"
fi

echo ""
echo "🔗 Access points (replace \${DOMAIN} with your domain):"
echo "- N8N MCP Server: https://n8n-mcp.\${DOMAIN}"
echo "- N8N: https://n8n.\${DOMAIN}"
echo ""
echo "📡 MCP Endpoints:"
echo "- JSON-RPC: POST https://n8n-mcp.\${DOMAIN}/mcp"
echo "- SSE Stream: GET https://n8n-mcp.\${DOMAIN}/mcp"
echo "- Health Check: GET https://n8n-mcp.\${DOMAIN}/health"
echo ""
echo "🧪 Test your setup:"
echo "./scripts/test-mcp.sh https://n8n-mcp.\${DOMAIN}"