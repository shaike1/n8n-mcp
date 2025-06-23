import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3004') || 3004, // Force 3004 for MCP
    host: process.env.HOST || '0.0.0.0',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || '',
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
  },
  mcp: {
    serverName: 'n8n-mcp-server',
    serverVersion: '1.0.0',
    streamHeartbeatInterval: parseInt(process.env.STREAM_HEARTBEAT_INTERVAL || '30000'),
    maxStreamClients: parseInt(process.env.MAX_STREAM_CLIENTS || '100'),
  },
  auth: {
    enabled: false, // Disable auth for Claude.ai HTTP MCP compatibility
    type: process.env.AUTH_TYPE || 'custom',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || '',
    sessionSecret: process.env.SESSION_SECRET || 'n8n-mcp-secret-key-change-me',
    jwtSecret: process.env.JWT_SECRET || 'jwt-secret-key-change-me',
    tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@your-domain.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
    adminName: process.env.ADMIN_NAME || 'Administrator',
  },
  domain: process.env.DOMAIN || 'localhost',
};