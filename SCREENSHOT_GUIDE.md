# Screenshot Capture Guide

## Screenshots Needed for README

Please capture the following screenshots and save them in the `screenshots/` directory:

### 1. Claude.ai Integration Setup
**File**: `screenshots/claude-ai-integrations.png`
- Go to Claude.ai → Settings → Integrations
- Show the "Add Integration" or "Custom Integration" page
- Capture the form where you enter the MCP server URL

### 2. MCP Server Configuration Form
**File**: `screenshots/mcp-server-config.png`
- The form in Claude.ai where you configure the MCP server
- Show fields for:
  - Integration Name: "N8N Workflow Manager"
  - Server URL: "https://your-domain.com"
  - Type: "MCP Server"

### 3. OAuth Authorization Page
**File**: `screenshots/oauth-authorization.png`
- The N8N MCP server authorization page that appears
- Shows the admin login form with N8N credentials fields
- URL should be something like: `https://your-domain.com/oauth/authorize?...`

### 4. N8N Credentials Form
**File**: `screenshots/n8n-credentials-form.png`
- The part of the authorization page with N8N instance fields:
  - N8N Host URL
  - N8N API Key
  - Login & Authorize button

### 5. OAuth Success/Consent Page
**File**: `screenshots/oauth-success.png`
- The page that appears after successful authentication
- Should show success message and redirect back to Claude.ai

### 6. Claude.ai Integration Connected
**File**: `screenshots/claude-integration-connected.png`
- Back in Claude.ai, showing the integration as "Connected"
- Should display the N8N MCP integration in the integrations list

### 7. Tools Available in Claude.ai
**File**: `screenshots/claude-tools-available.png`
- In a Claude.ai conversation, ask: "What MCP tools do you have available?"
- Show Claude.ai listing the 9 N8N tools

### 8. Workflow List Example
**File**: `screenshots/workflow-list-example.png`
- Ask Claude.ai: "Can you list my N8N workflows?"
- Show the response with actual workflow data

### 9. Server Logs/Debug Console
**File**: `screenshots/server-logs.png`
- Terminal showing `docker logs n8n-mcp-server -f`
- Should show MCP protocol messages and successful tool calls

### 10. Architecture Overview
**File**: `screenshots/architecture-overview.png` (optional)
- Can be a diagram created in draw.io or similar
- Shows Claude.ai → OAuth → MCP Server → N8N flow

## Screenshot Requirements

- **Resolution**: Minimum 1200px wide for clarity
- **Format**: PNG preferred for sharp text
- **Privacy**: Remove any sensitive information (API keys, domains, etc.)
- **Highlighting**: Use arrows or boxes to highlight important areas
- **Browser**: Use Chrome/Firefox for consistent appearance

## After Capturing Screenshots

1. Save all files in `screenshots/` directory
2. Update the README.md file to reference actual screenshot files
3. Commit and push the screenshots to GitHub

## Current Server Info for Screenshots

- **Server URL**: Check your domain configuration
- **Health Check**: `curl https://your-domain.com/health`
- **OAuth Discovery**: `curl https://your-domain.com/.well-known/oauth-authorization-server`

## Testing the Integration

To test the complete flow for screenshots:

1. Open Claude.ai in incognito/private browsing
2. Go to Settings → Integrations
3. Add the MCP server integration
4. Follow the OAuth flow
5. Test the tools in a conversation

This will give you the complete user journey for documentation.