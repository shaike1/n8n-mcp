# N8N MCP Server - Deployment Guide

This guide provides comprehensive deployment instructions for the N8N MCP Server with OAuth 2.1 authentication.

## 🎯 Overview

The N8N MCP Server is deployed as a Docker container with:
- OAuth 2.1 authentication with real username/password credentials
- Traefik reverse proxy for HTTPS and load balancing
- Secure session management and token handling
- Health checks and monitoring
- Production-ready security features

## 📋 Prerequisites

### System Requirements
- Linux server (Ubuntu 20.04+ recommended)
- Docker 20.10+
- Docker Compose 2.0+
- Minimum 2GB RAM
- 10GB disk space
- Domain name with DNS access

### External Dependencies
- N8N instance with API access
- Valid N8N API key
- SSL certificate (automated via Let's Encrypt)

## 🚀 Quick Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone and Configure

```bash
# Clone repository
git clone <repository-url>
cd n8nmcp

# Create external networks and volumes
docker network create traefik
docker volume create traefik_data
docker volume create n8n_data
```

### 3. Environment Configuration

Configure environment variables in the `docker-compose.yml` file:

```yaml
environment:
  # Core Configuration
  - PORT=3007
  - HOST=0.0.0.0
  - NODE_ENV=production
  
  # N8N Integration
  - N8N_BASE_URL=https://app.right-api.com
  - N8N_API_KEY=your_n8n_api_key_here
  
  # Authentication
  - ADMIN_USERNAME=admin
  - ADMIN_PASSWORD=your_password_hash_here
  
  # CORS and Security
  - CORS_ORIGIN=https://claude.ai,https://n8n-mcp.right-api.com,https://right-api.com
```

### 4. SSL Email Configuration

Update the SSL email in your docker-compose.yml:

```yaml
command:
  - "--certificatesresolvers.mytlschallenge.acme.email=your-email@domain.com"
```

### 5. Deploy Services

```bash
# Start Traefik first
docker-compose up -d traefik

# Wait for Traefik to be ready
sleep 30

# Start all services
docker-compose up -d

# Verify deployment
docker-compose ps
```

### 6. Verify Deployment

```bash
# Check health
curl https://n8n-mcp.your-domain.com/health

# Test OAuth discovery
curl https://n8n-mcp.your-domain.com/.well-known/oauth-authorization-server

# Check logs
docker logs n8n-mcp-server
```

## 🔧 Configuration Details

### Environment Variables

#### Core Server Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3007` | Yes |
| `HOST` | Bind address | `0.0.0.0` | Yes |
| `NODE_ENV` | Environment | `production` | Yes |

#### N8N Integration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `N8N_BASE_URL` | N8N instance URL | `https://app.right-api.com` | Yes |
| `N8N_API_KEY` | N8N API key | `eyJhbGciOiJIUzI1NiIs...` | Yes |

#### Authentication Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `ADMIN_USERNAME` | Admin username | `admin` | Yes |
| `ADMIN_PASSWORD` | Password hash (SHA-1) | `a0506a70dbaf3486...` | Yes |

#### Security Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CORS_ORIGIN` | Allowed origins | `https://claude.ai,https://domain.com` | No |

### Password Hash Generation

Generate a secure password hash:

```bash
# Method 1: Using echo and sha1sum
echo -n "your_secure_password" | sha1sum

# Method 2: Using Node.js
node -e "console.log(require('crypto').createHash('sha1').update('your_secure_password').digest('hex'))"

# Method 3: Using Python
python3 -c "import hashlib; print(hashlib.sha1(b'your_secure_password').hexdigest())"
```

### N8N API Key Setup

1. **Access N8N Admin Panel**
   ```
   https://your-n8n-instance.com
   ```

2. **Navigate to Settings > API**
   - Enable Public API
   - Create new API key
   - Copy the generated key

3. **Verify API Access**
   ```bash
   curl -H "X-N8N-API-KEY: your_api_key" \
        https://your-n8n-instance.com/api/v1/workflows
   ```

## 🔒 Security Configuration

### HTTPS/SSL Setup with Traefik

The deployment uses Traefik for automatic SSL certificate management:

```yaml
traefik:
  command:
    - "--certificatesresolvers.mytlschallenge.acme.tlschallenge=true"
    - "--certificatesresolvers.mytlschallenge.acme.email=your-email@domain.com"
    - "--certificatesresolvers.mytlschallenge.acme.storage=/letsencrypt/acme.json"
```

### Domain Configuration

Update Traefik labels for your domain:

```yaml
labels:
  - "traefik.http.routers.n8n-mcp-server.rule=Host(`n8n-mcp.your-domain.com`)"
  - "traefik.http.routers.n8n-mcp-server.tls.certresolver=mytlschallenge"
```

### Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (ensure this is configured first!)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Security Headers

The deployment includes security middleware via Traefik:

```yaml
- traefik.http.middlewares.n8n-headers.headers.SSLRedirect=true
- traefik.http.middlewares.n8n-headers.headers.STSSeconds=315360000
- traefik.http.middlewares.n8n-headers.headers.browserXSSFilter=true
- traefik.http.middlewares.n8n-headers.headers.contentTypeNosniff=true
- traefik.http.middlewares.n8n-headers.headers.forceSTSHeader=true
```

## 🐳 Docker Configuration

### Container Security

The Docker container runs with security best practices:

```dockerfile
# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Health checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"
```

### Volume Management

```yaml
volumes:
  # Persistent data
  n8n_mcp_data:/app/data
  
  # SSL certificates
  traefik_data:/letsencrypt
```

### Network Isolation

```yaml
networks:
  traefik:
    external: true
```

## 📊 Monitoring and Health Checks

### Health Check Configuration

```yaml
healthcheck:
  test: ["CMD", "sh", "-c", "ps aux | grep '[n]ode' || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Monitoring Endpoints

- **Health Check**: `GET /health`
- **Server Info**: `GET /`
- **OAuth Discovery**: `GET /.well-known/oauth-authorization-server`

### Log Collection

```bash
# View container logs
docker logs n8n-mcp-server -f

# Export logs
docker logs n8n-mcp-server > mcp-server.log

# Filter authentication logs
docker logs n8n-mcp-server 2>&1 | grep -i "auth"
```

## 🔄 Maintenance and Updates

### Regular Updates

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d

# Clean up old images
docker image prune -f
```

### Backup Procedures

```bash
# Backup volumes
docker run --rm -v n8n_mcp_data:/data -v $(pwd):/backup alpine tar czf /backup/mcp-data-backup.tar.gz -C /data .

# Backup Traefik certificates
docker run --rm -v traefik_data:/data -v $(pwd):/backup alpine tar czf /backup/traefik-backup.tar.gz -C /data .
```

### Restore Procedures

```bash
# Restore data volume
docker run --rm -v n8n_mcp_data:/data -v $(pwd):/backup alpine tar xzf /backup/mcp-data-backup.tar.gz -C /data

# Restore Traefik certificates
docker run --rm -v traefik_data:/data -v $(pwd):/backup alpine tar xzf /backup/traefik-backup.tar.gz -C /data
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### 1. SSL Certificate Issues

```bash
# Check Traefik logs
docker logs traefik

# Force certificate renewal
docker exec traefik traefik version

# Verify domain DNS
nslookup n8n-mcp.your-domain.com
```

#### 2. Authentication Problems

```bash
# Check admin credentials
echo -n "admin:your_password" | sha1sum

# Test authentication endpoint
curl -v https://n8n-mcp.your-domain.com/oauth/authorize
```

#### 3. N8N Connection Issues

```bash
# Test N8N API connectivity
docker exec n8n-mcp-server curl -H "X-N8N-API-KEY: your_key" https://your-n8n.com/api/v1/workflows

# Check network connectivity
docker exec n8n-mcp-server ping your-n8n-host
```

#### 4. Container Startup Issues

```bash
# Check container status
docker-compose ps

# View startup logs
docker logs n8n-mcp-server --since 10m

# Check resource usage
docker stats n8n-mcp-server
```

### Debug Mode

Enable verbose logging:

```yaml
environment:
  - NODE_ENV=development
  - DEBUG=*
```

## 🔐 Production Security Checklist

### Pre-Deployment
- [ ] Change default admin credentials
- [ ] Generate secure password hash
- [ ] Configure firewall rules
- [ ] Set up SSL certificates
- [ ] Review CORS origins
- [ ] Validate N8N API key

### Post-Deployment
- [ ] Test OAuth flow
- [ ] Verify HTTPS redirects
- [ ] Check health endpoints
- [ ] Monitor logs for errors
- [ ] Test MCP functionality
- [ ] Backup configuration

### Ongoing Maintenance
- [ ] Regular security updates
- [ ] Monitor authentication logs
- [ ] Rotate API keys periodically
- [ ] Review access logs
- [ ] Update SSL certificates
- [ ] Backup data regularly

## 📈 Performance Optimization

### Resource Allocation

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### Caching Configuration

```yaml
environment:
  - CACHE_TTL=300
  - MAX_CONNECTIONS=100
```

## 🌐 Multi-Instance Deployment

For high availability, deploy multiple instances:

```yaml
n8n-mcp-server:
  deploy:
    replicas: 3
  labels:
    - "traefik.http.services.n8n-mcp.loadbalancer.sticky=true"
```

## 📞 Support and Maintenance

### Log Analysis

```bash
# Error patterns
docker logs n8n-mcp-server 2>&1 | grep -i error

# Authentication attempts
docker logs n8n-mcp-server 2>&1 | grep -i "login\|auth"

# API calls
docker logs n8n-mcp-server 2>&1 | grep -i "tool called"
```

### Performance Monitoring

```bash
# Container resources
docker stats n8n-mcp-server

# Network connections
docker exec n8n-mcp-server netstat -an
```

---

This deployment guide ensures a secure, production-ready installation of the N8N MCP Server with proper authentication, monitoring, and maintenance procedures.