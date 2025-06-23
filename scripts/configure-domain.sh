#!/bin/bash

# Domain Configuration Helper Script for N8N MCP Server

set -e

echo "🌐 N8N MCP Server Domain Configuration"
echo "====================================="

# Load existing .env if it exists
if [ -f .env ]; then
    source .env
    echo "📝 Loaded existing configuration from .env"
else
    echo "📝 Creating new configuration..."
    cp .env.example .env
fi

echo ""
echo "Current configuration:"
echo "- Domain: ${DOMAIN:-not set}"
echo "- Cert Resolver: ${CERT_RESOLVER:-not set}"
echo "- N8N API Key: ${N8N_API_KEY:-not set}"
echo ""

# Get domain
read -p "🌍 Enter your domain (e.g., example.com): " NEW_DOMAIN
if [ -z "$NEW_DOMAIN" ]; then
    echo "❌ Domain cannot be empty"
    exit 1
fi

# Get certificate resolver
echo ""
echo "🔒 SSL Certificate Configuration"
echo "Common cert resolvers: letsencrypt, cloudflare, digitalocean"
read -p "Enter your Traefik certificate resolver name (default: letsencrypt): " NEW_CERT_RESOLVER
NEW_CERT_RESOLVER=${NEW_CERT_RESOLVER:-letsencrypt}

# Get N8N API Key
echo ""
read -p "🔑 Enter your N8N API Key (leave empty if not available): " NEW_API_KEY

# Update .env file
echo ""
echo "📝 Updating .env file..."

# Update or add DOMAIN
if grep -q "^DOMAIN=" .env; then
    sed -i "s/^DOMAIN=.*/DOMAIN=${NEW_DOMAIN}/" .env
else
    echo "DOMAIN=${NEW_DOMAIN}" >> .env
fi

# Update or add CERT_RESOLVER
if grep -q "^CERT_RESOLVER=" .env; then
    sed -i "s/^CERT_RESOLVER=.*/CERT_RESOLVER=${NEW_CERT_RESOLVER}/" .env
else
    echo "CERT_RESOLVER=${NEW_CERT_RESOLVER}" >> .env
fi

# Update N8N_API_KEY if provided
if [ ! -z "$NEW_API_KEY" ]; then
    if grep -q "^N8N_API_KEY=" .env; then
        sed -i "s/^N8N_API_KEY=.*/N8N_API_KEY=${NEW_API_KEY}/" .env
    else
        echo "N8N_API_KEY=${NEW_API_KEY}" >> .env
    fi
fi

# Update webhook URL
WEBHOOK_URL="https://n8n.${NEW_DOMAIN}/"
if grep -q "^WEBHOOK_URL=" .env; then
    sed -i "s|^WEBHOOK_URL=.*|WEBHOOK_URL=${WEBHOOK_URL}|" .env
else
    echo "WEBHOOK_URL=${WEBHOOK_URL}" >> .env
fi

# Update N8N_HOST
if grep -q "^N8N_HOST=" .env; then
    sed -i "s/^N8N_HOST=.*/N8N_HOST=n8n.${NEW_DOMAIN}/" .env
else
    echo "N8N_HOST=n8n.${NEW_DOMAIN}" >> .env
fi

echo "✅ Configuration updated!"
echo ""
echo "🔗 Your services will be available at:"
echo "- N8N MCP Server: https://n8n-mcp.${NEW_DOMAIN}"
echo "- N8N Instance: https://n8n.${NEW_DOMAIN}"
echo ""
echo "🏷️  Traefik Labels Applied:"
echo "- Host rule: n8n-mcp.${NEW_DOMAIN}"
echo "- TLS cert resolver: ${NEW_CERT_RESOLVER}"
echo "- Network: traefik"
echo ""
echo "⚠️  Make sure your existing Traefik:"
echo "1. Has access to the 'traefik' network"
echo "2. Has '${NEW_CERT_RESOLVER}' certificate resolver configured"
echo "3. Has entrypoints 'web' (80) and 'websecure' (443) configured"
echo "4. DNS records point ${NEW_DOMAIN} subdomains to your server"
echo ""
echo "🚀 Next steps:"
echo "1. Verify DNS records are configured"
echo "2. Start the services: docker-compose -f docker-compose.standalone.yml up -d"
echo "3. Check logs: docker-compose -f docker-compose.standalone.yml logs -f"
echo "4. Test: ./scripts/test-mcp.sh https://n8n-mcp.${NEW_DOMAIN}"