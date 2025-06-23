# N8N MCP Server

A Model Context Protocol (MCP) server that provides Claude.ai with direct access to N8N workflow automation capabilities through OAuth 2.1 authentication.

## Features

- **OAuth 2.1 Authentication** - Secure authentication flow for Claude.ai integration
- **Dynamic N8N Configuration** - Enter any N8N instance credentials during login
- **Comprehensive Workflow Management** - Create, read, update, delete, and execute workflows
- **Real-time Execution Control** - Start, stop, and monitor workflow executions
- **Multi-tenant Support** - Each user session maintains separate N8N credentials
- **Docker Ready** - Containerized deployment with Traefik integration

## Available Tools

The MCP server provides 9 N8N tools for workflow automation:

### Workflow Management
- `get_workflows` - List all workflows
- `get_workflow` - Get specific workflow details
- `create_workflow` - Create new workflows
- `update_workflow` - Update existing workflows
- `delete_workflow` - Delete workflows
- `activate_workflow` - Activate workflows
- `deactivate_workflow` - Deactivate workflows

### Execution Management
- `execute_workflow` - Execute workflows manually
- `get_executions` - View execution history and status

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd n8nmcp
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Docker Deployment

```bash
docker-compose up -d
```

### 4. Claude.ai Integration

1. Go to Claude.ai integrations
2. Add MCP server with URL: `https://your-mcp-server-domain.com/`
3. Complete OAuth flow with your admin credentials
4. Enter your N8N instance URL and API key

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3007) | No |
| `HOST` | Server host (default: 0.0.0.0) | No |
| `ADMIN_USERNAME` | Admin login username | Yes |
| `ADMIN_PASSWORD` | Admin password hash | Yes |
| `N8N_HOST` | Default N8N instance URL | No* |
| `N8N_API_KEY` | Default N8N API key | No* |
| `CORS_ORIGIN` | Allowed CORS origins | Yes |

*N8N credentials can be provided via environment variables as fallback or entered dynamically during login.

### Docker Compose

The included `docker-compose.yml` provides:
- N8N MCP Server container
- Traefik reverse proxy integration
- Automatic SSL certificates
- Health checks

## Authentication Flow

1. **OAuth Authorization** - Claude.ai redirects to authorization endpoint
2. **Admin Login** - Enter admin credentials and N8N instance details
3. **Consent Page** - Review and approve access permissions
4. **Token Exchange** - OAuth 2.1 PKCE flow completes
5. **Session Management** - Server maintains session with N8N credentials

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET/POST | MCP protocol endpoint |
| `/health` | GET | Health check |
| `/oauth/authorize` | GET | OAuth authorization |
| `/oauth/token` | POST | Token exchange |
| `/oauth/login` | POST | Admin authentication |
| `/.well-known/oauth-authorization-server` | GET | OAuth discovery |

## Security Features

- **OAuth 2.1 with PKCE** - Modern authentication standard
- **Session Isolation** - Each user session maintains separate credentials
- **Secure Credential Storage** - N8N credentials stored per-session, not globally
- **CORS Protection** - Configurable origin restrictions
- **Environment Variable Protection** - Sensitive data via environment variables

## Development

### Local Development

```bash
npm install
npm start
```

### Testing

```bash
# Test MCP tools directly
curl -X POST http://localhost:3007/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Deployment

### Production Deployment

1. Configure environment variables
2. Set up reverse proxy (Traefik/Nginx)
3. Enable SSL/TLS certificates
4. Configure domain name
5. Update CORS origins

### Traefik Labels

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.n8n-mcp.rule=Host(`your-mcp-server-domain.com`)"
  - "traefik.http.routers.n8n-mcp.entrypoints=websecure"
  - "traefik.http.routers.n8n-mcp.tls=true"
  - "traefik.http.routers.n8n-mcp.tls.certresolver=mytlschallenge"
```

## Architecture

```
Claude.ai → OAuth 2.1 → N8N MCP Server → N8N Instance
                ↓
            Session Management
                ↓
        Per-User N8N Credentials
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Troubleshooting

### Common Issues

**Tools not appearing in Claude.ai:**
- Verify OAuth flow completed successfully
- Check server logs for authentication errors
- Ensure N8N credentials are valid

**Connection timeouts:**
- Verify firewall settings
- Check reverse proxy configuration
- Validate SSL certificate

**N8N API errors:**
- Verify N8N instance is accessible
- Check API key permissions
- Confirm N8N version compatibility

### Logs

```bash
# View server logs
docker logs n8n-mcp-server -f

# View specific errors
docker logs n8n-mcp-server 2>&1 | grep ERROR
```

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: See docs/ directory
- Examples: See examples/ directory