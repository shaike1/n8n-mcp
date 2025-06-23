import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from './middleware/auth.js';
import { McpServer } from './services/mcp-server.js';
import { JsonRpcRequest } from './types/mcp.js';
import { config } from './config/index.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import { authService } from './services/auth-service.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import oauthRoutes from './routes/oauth.js';

const app = express();
const mcpServer = new McpServer();

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS configuration for production
const corsOptions = {
  origin: config.auth.enabled ? 
    [`https://n8n-mcp.${config.domain}`, `https://${config.domain}`, 'https://claude.ai'] :
    config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware (for OAuth)
if (config.auth.enabled) {
  app.use(session({
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.domain !== 'localhost',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());
}

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/oauth', oauthRoutes);

// Logging middleware for debugging Claude.ai requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Root endpoint for Claude.ai - handle both GET and POST
app.get('/', (req, res) => {
  console.log('Root GET endpoint accessed by:', req.headers['user-agent']);
  console.log('Accept header:', req.headers.accept);
  
  // Handle SSE connections for Claude.ai MCP streaming
  if (req.headers.accept?.includes('text/event-stream')) {
    console.log('SSE connection requested at root endpoint');
    try {
      // Add client to streaming pool
      const clientId = mcpServer.addStreamingClient(res);
      console.log(`SSE client connected at root: ${clientId}`);
      
      // Send initial server info
      mcpServer.broadcastToClients({
        type: 'server_info',
        data: mcpServer.getServerInfo(),
      });
      return;
    } catch (error) {
      console.error('SSE connection error at root:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to establish SSE connection',
      });
    }
  }
  
  // Return server info JSON (like HA MCP) for Claude.ai and API clients
  if (req.headers['user-agent']?.includes('python-httpx') || req.headers.accept?.includes('application/json')) {
    res.json({
      name: 'N8N MCP Server',
      version: '1.0.0',
      description: 'N8N Model Context Protocol Server for Claude',
      status: 'running',
      protocolVersion: '2024-11-05',
      features: {
        workflowManagement: true,
        executionControl: true,
        realTimeUpdates: true,
        oauth2: false,
        multiTenant: false,
        userRegistration: false,
        registrationEnabled: false
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: false },
        logging: {}
      },
      tools: mcpServer.getTools(),
      endpoints: {
        health: '/health',
        mcp: 'POST /',
        openapi: '/openapi.json'
      },
      serverInfo: mcpServer.getServerInfo(),
      documentation: {
        integration: 'Use https://n8n-mcp.right-api.com as MCP endpoint in Claude.ai'
      }
    });
  } else {
    // Redirect browser requests to auth page
    res.redirect('/auth/token-request');
  }
});

// Handle MCP JSON-RPC requests at root endpoint (Claude.ai does this)
app.post('/', async (req, res) => {
  console.log('Root POST endpoint accessed by:', req.headers['user-agent']);
  console.log('MCP Request method:', req.body.method);
  console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
  
  try {
    // For Claude.ai HTTP MCP - be completely permissive for all methods
    console.log('Processing MCP request without authentication (Claude.ai HTTP MCP compatibility)');
    const mcpResponse = await mcpServer.handleRequest(req.body);
    return res.json(mcpResponse);
  } catch (error) {
    console.error('MCP request error at root:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
});

// API info endpoint (moved from root)
app.get('/api', (req, res) => {
  res.json({
    name: 'N8N MCP Server API',
    version: '1.0.0',
    description: 'N8N Model Context Protocol Server with OAuth 2.0 authentication',
    documentation_url: `https://n8n-mcp.${config.domain}/openapi.json`,
    base_url: `https://n8n-mcp.${config.domain}`,
    auth: {
      type: 'oauth2',
      oauth2: {
        authorization_url: `https://n8n-mcp.${config.domain}/oauth/authorize`,
        token_url: `https://n8n-mcp.${config.domain}/oauth/token`,
        scopes: ['read', 'write']
      }
    },
    endpoints: {
      mcp: `https://n8n-mcp.${config.domain}/mcp`,
      health: `https://n8n-mcp.${config.domain}/health`,
      openapi: `https://n8n-mcp.${config.domain}/openapi.json`
    }
  });
});

// Alternative discovery endpoints
app.get('/api-docs', (req, res) => {
  res.redirect('/openapi.json');
});

app.get('/swagger.json', (req, res) => {
  res.redirect('/openapi.json');
});

// Direct OAuth initiation endpoint for Claude.ai
app.get('/connect', (req, res) => {
  const clientId = 'claude-ai-client';
  const redirectUri = 'https://claude.ai/oauth/callback';
  const scopes = 'read write';
  const state = String(req.query.state || 'claude-integration');
  
  const authUrl = `https://n8n-mcp.${config.domain}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  
  res.redirect(authUrl);
});

// MCP Discovery Endpoint
app.get('/.well-known/mcp', (req, res) => {
  res.json({
    version: "2024-11-05",
    name: "N8N MCP Server",
    description: "Control and manage N8N workflows",
    methods: ['initialize', 'tools/list', 'tools/call', 'notifications/initialized']
  });
});

// MCP Capabilities Discovery (for Claude.ai compatibility)
app.get('/.well-known/mcp_capabilities', (req, res) => {
  res.json({
    version: "2024-11-05",
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: false },
      logging: {}
    },
    serverInfo: mcpServer.getServerInfo(),
    transport: {
      type: "http",
      supports_sse: true,
      endpoints: {
        json_rpc: "/",
        sse: "/"
      }
    }
  });
});

// OAuth 2.0 Discovery Endpoint (like HA MCP)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: `https://n8n-mcp.${config.domain}`,
    authorization_endpoint: `https://n8n-mcp.${config.domain}/oauth/authorize`,
    token_endpoint: `https://n8n-mcp.${config.domain}/oauth/token`,
    userinfo_endpoint: `https://n8n-mcp.${config.domain}/oauth/userinfo`,
    registration_endpoint: `https://n8n-mcp.${config.domain}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    scopes_supported: ['mcp', 'n8n'],
    subject_types_supported: ['public']
  });
});

// OpenAPI/Swagger specification for Claude.ai discovery
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'N8N MCP Server API',
      version: '1.0.0',
      description: 'N8N Model Context Protocol Server with OAuth 2.0 authentication'
    },
    servers: [
      {
        url: `https://n8n-mcp.${config.domain}`,
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: `https://n8n-mcp.${config.domain}/oauth/authorize`,
              tokenUrl: `https://n8n-mcp.${config.domain}/oauth/token`,
              scopes: {
                read: 'Read access to N8N workflows',
                write: 'Write access to N8N workflows'
              }
            }
          }
        }
      }
    },
    paths: {
      '/mcp': {
        post: {
          summary: 'Execute MCP JSON-RPC calls',
          description: 'Send JSON-RPC requests to interact with N8N workflows',
          security: [{ oauth2: ['read', 'write'] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jsonrpc: { type: 'string', example: '2.0' },
                    method: { type: 'string', example: 'tools/list' },
                    params: { type: 'object' },
                    id: { type: 'number', example: 1 }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      jsonrpc: { type: 'string' },
                      id: { type: 'number' },
                      result: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/health': {
        get: {
          summary: 'Health check endpoint',
          description: 'Check server health and status',
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string' },
                      auth: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: mcpServer.getServerInfo(),
    auth: {
      enabled: config.auth.enabled,
      configured: !!(config.auth.clientId && config.auth.clientSecret),
    },
    domain: config.domain,
  });
});

// N8N-style health endpoint (like desktop app)
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok'
  });
});

// MCP JSON-RPC endpoint for Claude.ai (no auth required)
app.post('/claude', async (req, res) => {
  try {
    // Validate JSON-RPC request
    const request: JsonRpcRequest = req.body;
    if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
    }

    // Handle the request
    const response = await mcpServer.handleRequest(request);
    
    // For streaming responses, return 202 Accepted
    if (request.method.includes('execute') || request.method.includes('stream')) {
      res.status(202).send();
    } else {
      res.json(response);
    }
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
});

// MCP JSON-RPC endpoint (HTTP POST) - Protected with auth if enabled
app.post('/mcp', requireAuth, async (req, res) => {
  try {
    // Validate JSON-RPC request
    const request: JsonRpcRequest = req.body;
    if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
    }

    // Handle the request
    const response = await mcpServer.handleRequest(request);
    
    // For streaming responses, return 202 Accepted
    if (request.method.includes('execute') || request.method.includes('stream')) {
      res.status(202).send();
    } else {
      res.json(response);
    }
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
});

// MCP SSE streaming endpoint (HTTP GET) - Protected with auth if enabled
app.get('/mcp', requireAuth, (req, res) => {
  try {
    const acceptHeader = req.headers.accept || '';
    
    if (!acceptHeader.includes('text/event-stream')) {
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: 'This endpoint requires Accept: text/event-stream header',
      });
    }

    // Add client to streaming pool
    const clientId = mcpServer.addStreamingClient(res);
    console.log(`SSE client connected: ${clientId}`);
    
    // Send initial server info
    mcpServer.broadcastToClients({
      type: 'server_info',
      data: mcpServer.getServerInfo(),
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to establish SSE connection',
    });
  }
});

// Batch JSON-RPC endpoint - Protected with auth if enabled
app.post('/mcp/batch', requireAuth, async (req, res) => {
  try {
    const requests: JsonRpcRequest[] = Array.isArray(req.body) ? req.body : [req.body];
    const responses = await Promise.all(
      requests.map(request => mcpServer.handleRequest(request))
    );
    
    res.json(responses);
  } catch (error) {
    console.error('Batch request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  console.log(`N8N MCP Server running on ${config.server.host}:${config.server.port}`);
  console.log(`Environment PORT: ${process.env.PORT}`);
  console.log(`Config port: ${config.server.port}`);
  console.log(`Health check: http://${config.server.host}:${config.server.port}/health`);
  console.log(`MCP endpoint: http://${config.server.host}:${config.server.port}/mcp`);
  console.log(`Dashboard: https://n8n-mcp.${config.domain}/dashboard`);
  console.log(`N8N API: ${config.n8n.baseUrl}`);
  
  if (config.auth.enabled) {
    console.log(`🔒 Authentication: ENABLED`);
    console.log(`🚀 OAuth Login: https://n8n-mcp.${config.domain}/auth/login`);
    if (!config.auth.clientId || !config.auth.clientSecret) {
      console.warn('⚠️  OAuth not configured! Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET');
    }
  } else {
    console.log(`🔓 Authentication: DISABLED (Set AUTH_ENABLED=true to enable)`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  mcpServer.destroy();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  mcpServer.destroy();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;