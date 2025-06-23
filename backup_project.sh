#!/bin/bash

# N8N MCP Server Project Backup Script
# Creates a complete backup of the project with documentation

set -e

BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
PROJECT_ROOT="/root/n8nmcp"

echo "🔄 Creating N8N MCP Server project backup..."

# Create backup directory
mkdir -p "$PROJECT_ROOT/$BACKUP_DIR"

echo "📁 Copying core files..."

# Copy main application files
cp "$PROJECT_ROOT/oauth-mcp-server.js" "$PROJECT_ROOT/$BACKUP_DIR/"
cp "$PROJECT_ROOT/Dockerfile" "$PROJECT_ROOT/$BACKUP_DIR/"
cp "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/$BACKUP_DIR/"

# Copy Docker Compose configuration
cp "/root/docker-compose.yml" "$PROJECT_ROOT/$BACKUP_DIR/docker-compose-main.yml"

# Copy documentation
cp "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/$BACKUP_DIR/"
cp "$PROJECT_ROOT/DEPLOYMENT.md" "$PROJECT_ROOT/$BACKUP_DIR/"

# Copy existing backup summary if it exists
if [ -f "$PROJECT_ROOT/backup/PROJECT_BACKUP_SUMMARY.md" ]; then
    cp "$PROJECT_ROOT/backup/PROJECT_BACKUP_SUMMARY.md" "$PROJECT_ROOT/$BACKUP_DIR/"
fi

echo "📊 Generating backup report..."

# Create backup report
cat > "$PROJECT_ROOT/$BACKUP_DIR/BACKUP_REPORT.md" << EOF
# N8N MCP Server - Backup Report

**Backup Date**: $(date)
**Backup Directory**: $BACKUP_DIR
**Server Status**: $(systemctl is-active docker 2>/dev/null || echo "Unknown")

## Files Backed Up

$(ls -la "$PROJECT_ROOT/$BACKUP_DIR" | tail -n +2)

## Current Container Status

\`\`\`
$(docker ps --filter name=n8n-mcp-server --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running")
\`\`\`

## Configuration Summary

- **Authentication**: OAuth 2.1 with username/password
- **Security**: Real credentials replacing security theater
- **MCP Tools**: 7 N8N workflow management tools
- **Transport**: Streamable HTTP with health checks
- **Deployment**: Docker with Traefik reverse proxy

## Restoration Command

\`\`\`bash
cd /root/n8nmcp
cp $BACKUP_DIR/* .
docker-compose up -d
\`\`\`

EOF

echo "🔄 Creating compressed archive..."

# Create compressed backup
cd "$PROJECT_ROOT"
tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"

echo "🧹 Cleaning up temporary directory..."
rm -rf "$BACKUP_DIR"

echo "✅ Backup completed successfully!"
echo "📁 Backup file: $PROJECT_ROOT/${BACKUP_DIR}.tar.gz"
echo "📊 Backup size: $(du -h "$PROJECT_ROOT/${BACKUP_DIR}.tar.gz" | cut -f1)"

# Show backup contents
echo ""
echo "📋 Backup contents:"
tar -tzf "${BACKUP_DIR}.tar.gz" | head -20

echo ""
echo "🔍 To restore this backup:"
echo "  tar -xzf ${BACKUP_DIR}.tar.gz"
echo "  cd ${BACKUP_DIR%.*}"
echo "  # Configure environment variables"
echo "  docker-compose up -d"

exit 0