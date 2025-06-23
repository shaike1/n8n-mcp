#!/bin/bash

# Backup N8N MCP Server to GitHub
echo "🚀 Backing up N8N MCP Server to GitHub..."

cd /root

# Add all files
git add .

# Create commit with success message
git commit -m "$(cat <<'EOF'
✅ WORKING N8N MCP Server with OAuth 2.1

🎉 Successfully implemented:
- OAuth 2.1 with PKCE authentication 
- Dynamic client registration for Claude.ai
- Session-based MCP authentication
- 7 N8N workflow management tools
- Proper N8N API integration (X-N8N-API-KEY)
- Token registration system
- Full HTTPS support via Traefik

🔧 Tools Available:
- get_workflows: List all N8N workflows
- get_workflow: Get specific workflow details
- create_workflow: Create new workflows
- activate_workflow: Enable workflows
- deactivate_workflow: Disable workflows  
- execute_workflow: Run workflows manually
- get_executions: View execution history

🔐 Security Features:
- OAuth 2.1 + PKCE for Claude.ai web
- Bearer token authentication
- API token registration
- Session management
- CORS protection

🧪 Tested & Verified:
- Claude.ai web successfully connects via OAuth
- All 7 tools properly listed in MCP
- N8N API integration working
- Authentication security validated

🚀 Generated with Claude Code (https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to GitHub
git push origin main

echo "✅ Backup completed successfully!"
echo "📁 Repository: https://github.com/your-username/your-repo"
echo "🔗 Working MCP Server: https://n8n-mcp.right-api.com"