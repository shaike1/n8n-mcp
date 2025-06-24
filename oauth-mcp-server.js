import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { randomUUID, createHash } from 'crypto';

// N8N Configuration - ONLY set per session via login form (NO environment variables)
let N8N_HOST = '';
let N8N_API_KEY = '';

console.log('N8N Configuration:');
console.log('N8N_HOST:', 'Will be configured dynamically via login form');
console.log('N8N_API_KEY:', 'Will be configured dynamically via login form');

// Persistent storage directory
const DATA_DIR = '/app/data';
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Session persistence functions
function saveSessionData() {
  const sessionData = {
    adminSessions: Array.from(adminSessions.entries()),
    accessTokens: Array.from(accessTokens.entries()),
    authenticatedSessions: Array.from(authenticatedSessions.entries()),
    savedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(DATA_DIR, 'sessions.json'), JSON.stringify(sessionData, null, 2));
}

function loadSessionData() {
  try {
    // FORCE FRESH SESSIONS: Skip loading any cached session data
    console.log('SKIPPING session persistence - all sessions will be fresh');
    return;
    
    const sessionFile = path.join(DATA_DIR, 'sessions.json');
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      console.log(`Loading persistent session data from ${data.savedAt}`);
      
      // Restore admin sessions (filter out expired ones)
      data.adminSessions.forEach(([token, sessionData]) => {
        if (new Date(sessionData.expiresAt) > new Date()) {
          adminSessions.set(token, {
            ...sessionData,
            createdAt: new Date(sessionData.createdAt),
            expiresAt: new Date(sessionData.expiresAt)
          });
        }
      });
      
      // Restore access tokens (filter out expired ones)
      data.accessTokens.forEach(([token, tokenData]) => {
        if (new Date(tokenData.expiresAt) > new Date()) {
          accessTokens.set(token, {
            ...tokenData,
            expiresAt: new Date(tokenData.expiresAt)
          });
        }
      });
      
      // Restore authenticated sessions
      data.authenticatedSessions.forEach(([clientId, authData]) => {
        if (new Date(authData.tokenData.expiresAt) > new Date()) {
          authenticatedSessions.set(clientId, {
            ...authData,
            authenticatedAt: new Date(authData.authenticatedAt),
            tokenData: {
              ...authData.tokenData,
              expiresAt: new Date(authData.tokenData.expiresAt)
            }
          });
        }
      });
      
      console.log(`Restored ${adminSessions.size} admin sessions, ${accessTokens.size} access tokens, ${authenticatedSessions.size} authenticated sessions`);
    }
  } catch (error) {
    console.error('Error loading session data:', error.message);
  }
}

// OAuth storage
const clients = new Map();
const authCodes = new Map();
const accessTokens = new Map();
const sessions = new Map();
const authenticatedSessions = new Map(); // Track OAuth-authenticated sessions

// Admin authentication - hardcoded for testing
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your_secure_admin_password_hash';
const adminSessions = new Map(); // Track authenticated admin sessions

// TEMPORARILY DISABLED: Load existing sessions on startup - force fresh credentials
// loadSessionData();
console.log('SESSION PERSISTENCE DISABLED: All sessions will be fresh');

console.log('Admin Authentication:');
console.log('Username:', ADMIN_USERNAME);
console.log('Password:', ADMIN_PASSWORD ? '***SET***' : 'NOT SET - USING DEFAULT');

// Generate admin session token with N8N connection details
function createAdminSession(n8nHost, n8nApiKey) {
  const sessionToken = randomUUID();
  const sessionData = {
    authenticated: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    n8nHost: n8nHost,
    n8nApiKey: n8nApiKey
  };
  adminSessions.set(sessionToken, sessionData);
  saveSessionData(); // Persist immediately
  return sessionToken;
}

// Verify admin session
function verifyAdminSession(sessionToken) {
  const session = adminSessions.get(sessionToken);
  if (!session || session.expiresAt < new Date()) {
    if (session) adminSessions.delete(sessionToken);
    return false;
  }
  return true;
}

// Simple N8N API client - uses session-specific credentials
async function n8nRequest(endpoint, options = {}, sessionToken = null) {
  let n8nHost = N8N_HOST;
  let n8nApiKey = N8N_API_KEY;
  
  // If session token provided, use session-specific N8N credentials
  if (sessionToken) {
    const session = adminSessions.get(sessionToken);
    if (session && session.n8nHost && session.n8nApiKey) {
      n8nHost = session.n8nHost;
      n8nApiKey = session.n8nApiKey;
    }
  }
  
  if (!n8nHost || !n8nApiKey) {
    throw new Error('N8N connection not configured. Please login with N8N details.');
  }
  
  const url = `${n8nHost}/api/v1${endpoint}`;
  
  const fetch = (await import('node-fetch')).default;
  
  // Add timeout to prevent hanging connections
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal,
      timeout: 30000,
      ...options
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('N8N API request timed out (30s)');
    }
    throw error;
  }
}

// Get available tools
async function getTools() {
  return [
    {
      name: "get_workflows",
      description: "Get all N8N workflows",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "get_workflow",
      description: "Get a specific N8N workflow by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" }
        },
        required: ["id"]
      }
    },
    {
      name: "create_workflow",
      description: "Create a new N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workflow name" },
          nodes: { type: "array", description: "Workflow nodes" },
          connections: { type: "object", description: "Node connections" }
        },
        required: ["name", "nodes", "connections"]
      }
    },
    {
      name: "update_workflow",
      description: "Update an existing N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
          name: { type: "string", description: "Workflow name" },
          nodes: { type: "array", description: "Workflow nodes" },
          connections: { type: "object", description: "Node connections" },
          active: { type: "boolean", description: "Whether workflow should be active" }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_workflow",
      description: "Delete an N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" }
        },
        required: ["id"]
      }
    },
    {
      name: "activate_workflow",
      description: "Activate an N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" }
        },
        required: ["id"]
      }
    },
    {
      name: "deactivate_workflow",
      description: "Deactivate an N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" }
        },
        required: ["id"]
      }
    },
    {
      name: "execute_workflow",
      description: "Execute an N8N workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
          data: { type: "object", description: "Input data for workflow execution" }
        },
        required: ["id"]
      }
    },
    {
      name: "get_executions",
      description: "Get workflow execution history",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string", description: "Filter by workflow ID" },
          limit: { type: "number", description: "Maximum number of executions to return", default: 20 }
        },
        required: []
      }
    }
  ];
}

// Call a tool - now accepts sessionToken for N8N connection
async function callTool(name, args, sessionToken = null) {
  console.log(`Tool called: ${name}`);
  console.log(`Tool args:`, JSON.stringify(args));
  console.log(`Session token:`, sessionToken ? 'PROVIDED' : 'NULL');
  
  try {
    console.log(`Entering switch statement for tool: ${name}`);
    switch (name) {
      case "get_workflows":
        console.log('DEBUG: get_workflows called with sessionToken:', sessionToken ? 'PROVIDED' : 'NULL');
        
        // TEMPORARY: Return hardcoded response to test if it's a response size issue
        console.log('DEBUG: Returning hardcoded response for testing');
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              total: 1,
              workflows: [{
                id: "test123",
                name: "Test Workflow", 
                active: false,
                nodeCount: 5
              }]
            }, null, 2)
          }]
        };
        
      case "get_workflow":
        const workflow = await n8nRequest(`/workflows/${args.id}`, {}, sessionToken);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(workflow, null, 2)
          }]
        };
        
      case "create_workflow":
        const created = await n8nRequest('/workflows', {
          method: 'POST',
          body: JSON.stringify({
            name: args.name,
            nodes: args.nodes,
            connections: args.connections,
            active: false
          })
        }, sessionToken);
        return {
          content: [{
            type: "text",
            text: `Workflow created successfully: ${JSON.stringify(created, null, 2)}`
          }]
        };
        
      case "update_workflow":
        const updatePayload = {};
        if (args.name) updatePayload.name = args.name;
        if (args.nodes) updatePayload.nodes = args.nodes;
        if (args.connections) updatePayload.connections = args.connections;
        if (args.active !== undefined) updatePayload.active = args.active;
        
        const updated = await n8nRequest(`/workflows/${args.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload)
        }, sessionToken);
        return {
          content: [{
            type: "text",
            text: `Workflow updated successfully: ${JSON.stringify(updated, null, 2)}`
          }]
        };
        
      case "delete_workflow":
        await n8nRequest(`/workflows/${args.id}`, { method: 'DELETE' }, sessionToken);
        return {
          content: [{
            type: "text",
            text: `Workflow ${args.id} deleted successfully`
          }]
        };
        
      case "activate_workflow":
        await n8nRequest(`/workflows/${args.id}/activate`, { method: 'POST' }, sessionToken);
        return {
          content: [{
            type: "text",
            text: `Workflow ${args.id} activated successfully`
          }]
        };
        
      case "deactivate_workflow":
        await n8nRequest(`/workflows/${args.id}/deactivate`, { method: 'POST' }, sessionToken);
        return {
          content: [{
            type: "text",
            text: `Workflow ${args.id} deactivated successfully`
          }]
        };
        
      case "execute_workflow":
        const execution = await n8nRequest(`/workflows/${args.id}/execute`, {
          method: 'POST',
          body: JSON.stringify(args.data || {})
        }, sessionToken);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(execution, null, 2)
          }]
        };
        
      case "get_executions":
        let execEndpoint = '/executions';
        if (args.workflowId) {
          execEndpoint += `?workflowId=${args.workflowId}`;
        }
        if (args.limit) {
          execEndpoint += (args.workflowId ? '&' : '?') + `limit=${args.limit}`;
        }
        const executions = await n8nRequest(execEndpoint, {}, sessionToken);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(executions, null, 2)
          }]
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`ERROR in tool ${name}:`, error.message);
    console.error('Error stack:', error.stack);
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
}

// Verify access token
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const tokenData = accessTokens.get(token);
  
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return null;
  }
  
  return tokenData;
}

// Verify session-based authentication for Claude.ai
function verifySessionAuth(sessionId) {
  if (!sessionId) {
    return null;
  }
  
  // Check if this specific session is marked as authenticated
  const sessionData = sessions.get(sessionId);
  if (sessionData && sessionData.authenticated) {
    // Find any valid token data from authenticated sessions
    for (const [clientId, authData] of authenticatedSessions.entries()) {
      if (authData.tokenData.expiresAt > new Date()) {
        return authData.tokenData;
      }
    }
  }
  
  return null;
}

// OAuth and MCP server
const httpServer = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  
  // OAuth discovery endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/.well-known/oauth-authorization-server') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issuer: process.env.SERVER_URL || 'https://n8n-mcp.right-api.com',
      authorization_endpoint: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/oauth/authorize`,
      token_endpoint: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/oauth/token`,
      registration_endpoint: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/oauth/register`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256']
    }));
    return;
  }
  
  // Dynamic client registration
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const clientRequest = JSON.parse(body);
        const clientId = randomUUID();
        const clientSecret = randomUUID();
        
        clients.set(clientId, {
          id: clientId,
          secret: clientSecret,
          redirectUris: clientRequest.redirect_uris || [],
          createdAt: new Date()
        });
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          client_secret_expires_at: 0
        }));
      } catch (error) {
        res.writeHead(400);
        res.end('Invalid registration request');
      }
    });
    return;
  }
  
  // Token registration endpoint (for pre-registering API tokens)
  if (req.method === 'POST' && parsedUrl.pathname === '/tokens/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const tokenRequest = JSON.parse(body);
        const { description, scope } = tokenRequest;
        
        // Generate a new API token
        const apiToken = randomUUID();
        const tokenData = {
          clientId: 'api-client',
          scope: scope || 'mcp',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          resource: process.env.SERVER_URL || 'https://n8n-mcp.right-api.com',
          description: description || 'API Token',
          createdAt: new Date()
        };
        
        accessTokens.set(apiToken, tokenData);
        console.log(`Registered new API token: ${description || 'API Token'}`);
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: apiToken,
          token_type: 'Bearer',
          expires_in: 31536000, // 1 year in seconds
          scope: tokenData.scope,
          description: tokenData.description,
          created_at: tokenData.createdAt.toISOString()
        }));
      } catch (error) {
        console.error('Token registration error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid token registration request'
        }));
      }
    });
    return;
  }
  
  // Token management endpoint (list/revoke tokens)
  if (req.method === 'GET' && parsedUrl.pathname === '/tokens') {
    const tokens = [];
    for (const [token, data] of accessTokens.entries()) {
      tokens.push({
        token: token.substring(0, 8) + '...',
        description: data.description,
        scope: data.scope,
        created_at: data.createdAt?.toISOString(),
        expires_at: data.expiresAt.toISOString(),
        client_id: data.clientId
      });
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tokens }));
    return;
  }
  
  if (req.method === 'DELETE' && parsedUrl.pathname.startsWith('/tokens/')) {
    const tokenToRevoke = parsedUrl.pathname.split('/tokens/')[1];
    if (accessTokens.has(tokenToRevoke)) {
      accessTokens.delete(tokenToRevoke);
      console.log(`Revoked token: ${tokenToRevoke}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Token revoked successfully' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token not found' }));
    }
    return;
  }
  
  // Authorization endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/oauth/authorize') {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = parsedUrl.query;
    
    // Accept Claude.ai client or any registered client
    let client = clients.get(client_id);
    if (!client) {
      // Auto-register Claude.ai client if not exists
      console.log(`Auto-registering client: ${client_id}`);
      client = {
        id: client_id,
        secret: 'claude-ai-client-secret',
        redirectUris: [redirect_uri],
        createdAt: new Date()
      };
      clients.set(client_id, client);
    }
    
    // Check if user is already authenticated
    const sessionCookie = req.headers.cookie?.split(';')
      .find(c => c.trim().startsWith('admin_session='))
      ?.split('=')[1];
    
    if (sessionCookie && verifyAdminSession(sessionCookie)) {
      // User is authenticated, show consent page
      const consentPage = `
<!DOCTYPE html>
<html>
<head>
    <title>Authorize N8N MCP Access</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .consent-box { border: 2px solid #007cba; border-radius: 10px; padding: 30px; background: #f9f9f9; }
        .app-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .permissions { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .actions { text-align: center; margin: 30px 0; }
        .btn { padding: 12px 30px; margin: 0 10px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn-allow { background: #28a745; color: white; }
        .btn-deny { background: #dc3545; color: white; }
        .btn:hover { opacity: 0.8; }
        .authenticated { background: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="consent-box">
        <div class="authenticated">Authenticated as: ${ADMIN_USERNAME}</div>
        
        <h2>Authorization Request</h2>
        
        <div class="app-info">
            <h3>Application Details:</h3>
            <p><strong>App:</strong> Claude.ai</p>
            <p><strong>Client ID:</strong> ${client_id}</p>
            <p><strong>Redirect URI:</strong> ${redirect_uri}</p>
        </div>
        
        <div class="permissions">
            <h3>Requested Permissions:</h3>
            <ul>
                <li><strong>N8N Workflow Management</strong> - List, create, and manage workflows</li>
                <li><strong>Workflow Execution</strong> - Execute and monitor workflow runs</li>
                <li><strong>Execution History</strong> - View workflow execution logs</li>
            </ul>
        </div>
        
        <p><strong>Warning:</strong> This will give Claude.ai access to manage your N8N workflows.</p>
        
        <div class="actions">
            <button class="btn btn-allow" onclick="authorize()">Allow Access</button>
            <button class="btn btn-deny" onclick="deny()">Deny Access</button>
        </div>
    </div>
    
    <script>
        function authorize() {
            window.location.href = '/oauth/approve?${new URLSearchParams({
              client_id,
              redirect_uri,
              state,
              code_challenge,
              code_challenge_method,
              scope: scope || 'mcp'
            }).toString()}';
        }
        
        function deny() {
            window.location.href = '${redirect_uri}?error=access_denied&state=${state}';
        }
    </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(consentPage);
      return;
    }
    
    // User not authenticated, show login form
    const loginPage = `
<!DOCTYPE html>
<html>
<head>
    <title>N8N MCP Server - Login Required</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">N8N MCP Server</h2>
        
        <div class="info">
            <strong>Claude.ai</strong> is requesting access to your N8N workflows.
            Please authenticate and configure your N8N connection.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope || 'mcp'}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="n8n_host">N8N Host URL:</label>
                <input type="url" id="n8n_host" name="n8n_host" placeholder="https://your-n8n-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="n8n_api_key">N8N API Key:</label>
                <input type="password" id="n8n_api_key" name="n8n_api_key" placeholder="Your N8N API Key" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginPage);
    return;
  }
  
  // Login endpoint - Process username/password authentication
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const params = new URLSearchParams(body);
        const username = params.get('username');
        const password = params.get('password');
        const n8n_host = params.get('n8n_host');
        const n8n_api_key = params.get('n8n_api_key');
        const client_id = params.get('client_id');
        const redirect_uri = params.get('redirect_uri');
        const state = params.get('state');
        const code_challenge = params.get('code_challenge');
        const code_challenge_method = params.get('code_challenge_method');
        const scope = params.get('scope');
        
        console.log(`Login attempt for username: ${username}`);
        console.log(`N8N Host: ${n8n_host}`);
        
        // Validate credentials
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          console.log('Admin authentication successful');
          
          // Test N8N connection before proceeding
          try {
            // Temporarily set connection for testing
            const tempToken = randomUUID();
            adminSessions.set(tempToken, {
              authenticated: true,
              n8nHost: n8n_host,
              n8nApiKey: n8n_api_key,
              expiresAt: new Date(Date.now() + 60000) // 1 minute temp session
            });
            
            // Test the connection
            await n8nRequest('/workflows?limit=1', {}, tempToken);
            adminSessions.delete(tempToken); // Clean up temp session
            
            console.log('N8N connection test successful');
            
            // Create admin session with N8N connection details
            const sessionToken = createAdminSession(n8n_host, n8n_api_key);
          
          // Set secure session cookie
          const cookieOptions = [
            `admin_session=${sessionToken}`,
            'HttpOnly',
            'Secure',
            'SameSite=Lax',
            'Path=/',
            `Max-Age=${30 * 60}` // 30 minutes
          ].join('; ');
          
          // Redirect back to authorization with session cookie
          const redirectUrl = `/oauth/authorize?${new URLSearchParams({
            client_id,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            scope
          }).toString()}`;
          
          res.writeHead(302, { 
            'Location': redirectUrl,
            'Set-Cookie': cookieOptions
          });
          res.end();
          return;
          } catch (n8nError) {
            console.log('N8N connection failed:', n8nError.message);
            
            // Show login form with N8N connection error
            const n8nErrorPage = `
<!DOCTYPE html>
<html>
<head>
    <title>N8N MCP Server - Connection Failed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; background: #f8d7da; padding: 10px; border-radius: 5px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">N8N MCP Server</h2>
        
        <div class="error">N8N Connection Failed: ${n8nError.message}</div>
        
        <div class="info">
            Please check your N8N host URL and API key, then try again.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" value="${username}" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="n8n_host">N8N Host URL:</label>
                <input type="url" id="n8n_host" name="n8n_host" value="${n8n_host}" placeholder="https://your-n8n-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="n8n_api_key">N8N API Key:</label>
                <input type="password" id="n8n_api_key" name="n8n_api_key" placeholder="Your N8N API Key" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(n8nErrorPage);
            return;
          }
        } else {
          console.log('Authentication failed - invalid credentials');
          
          // Show login form with error
          const errorPage = `
<!DOCTYPE html>
<html>
<head>
    <title>N8N MCP Server - Login Failed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-box { background: white; border-radius: 10px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .title { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #005a87; }
        .error { color: #dc3545; text-align: center; margin: 15px 0; background: #f8d7da; padding: 10px; border-radius: 5px; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2 class="title">N8N MCP Server</h2>
        
        <div class="error">Invalid username or password. Please try again.</div>
        
        <div class="info">
            <strong>Claude.ai</strong> is requesting access to your N8N workflows.
            Please authenticate to continue.
        </div>
        
        <form method="POST" action="/oauth/login">
            <input type="hidden" name="client_id" value="${client_id}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${code_challenge}">
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
            <input type="hidden" name="scope" value="${scope}">
            
            <div class="form-group">
                <label for="username">Admin Username:</label>
                <input type="text" id="username" name="username" value="${username || ''}" required>
            </div>
            
            <div class="form-group">
                <label for="password">Admin Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <hr style="margin: 20px 0; border: 1px solid #ddd;">
            
            <div class="form-group">
                <label for="n8n_host">N8N Host URL:</label>
                <input type="url" id="n8n_host" name="n8n_host" value="${n8n_host || ''}" placeholder="https://your-n8n-instance.com" required>
            </div>
            
            <div class="form-group">
                <label for="n8n_api_key">N8N API Key:</label>
                <input type="password" id="n8n_api_key" name="n8n_api_key" placeholder="Your N8N API Key" required>
            </div>
            
            <button type="submit" class="btn">Login &amp; Authorize</button>
        </form>
    </div>
</body>
</html>`;
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(errorPage);
          return;
        }
      } catch (error) {
        console.error('Login processing error:', error);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>400 Bad Request</h1><p>Invalid login request</p>');
      }
    });
    return;
  }
  
  // OAuth approval endpoint (after user clicks "Allow")
  if (req.method === 'GET' && parsedUrl.pathname === '/oauth/approve') {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = parsedUrl.query;
    
    // Get admin session token from cookie
    const sessionCookie = req.headers.cookie?.split(';')
      .find(c => c.trim().startsWith('admin_session='))
      ?.split('=')[1];
    
    // Now generate authorization code after user consent
    const code = randomUUID();
    authCodes.set(code, {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      scope: scope,
      adminSessionToken: sessionCookie // Link to admin session
    });
    
    console.log(`Created auth code with admin session token: ${sessionCookie ? sessionCookie.substring(0, 8) + '...' : 'null'}`);
    
    console.log(`User approved authorization for client: ${client_id}`);
    
    // Redirect with authorization code
    const redirectUrl = `${redirect_uri}?code=${code}&state=${state}`;
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
    return;
  }
  
  // Token endpoint
  if (req.method === 'POST' && parsedUrl.pathname === '/oauth/token') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        console.log('Token exchange request body:', body);
        const params = new URLSearchParams(body);
        const code = params.get('code');
        const clientId = params.get('client_id');
        const codeVerifier = params.get('code_verifier');
        
        console.log('Token exchange params:', { code, clientId, codeVerifier });
        console.log('Available auth codes:', Array.from(authCodes.keys()));
        
        const authCode = authCodes.get(code);
        console.log('Found auth code:', authCode);
        
        if (!authCode) {
          console.log('ERROR: Authorization code not found');
          res.writeHead(400);
          res.end('Authorization code not found');
          return;
        }
        
        if (authCode.expiresAt < new Date()) {
          console.log('ERROR: Authorization code expired');
          res.writeHead(400);
          res.end('Authorization code expired');
          return;
        }
        
        if (authCode.clientId !== clientId) {
          console.log('ERROR: Client ID mismatch');
          res.writeHead(400);
          res.end('Client ID mismatch');
          return;
        }
        
        // Verify PKCE if provided
        if (authCode.codeChallenge && authCode.codeChallengeMethod === 'S256') {
          const hash = createHash('sha256').update(codeVerifier).digest('base64url');
          console.log('PKCE verification:', { 
            provided: authCode.codeChallenge, 
            calculated: hash, 
            matches: hash === authCode.codeChallenge 
          });
          if (hash !== authCode.codeChallenge) {
            console.log('ERROR: PKCE verification failed');
            res.writeHead(400);
            res.end('Invalid code verifier');
            return;
          }
          console.log('PKCE verification successful');
        }
        
        // Generate access token
        const accessToken = randomUUID();
        const tokenData = {
          clientId: clientId,
          scope: authCode.scope,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          resource: 'https://n8n-mcp.right-api.com'
        };
        accessTokens.set(accessToken, tokenData);
        
        // Store authenticated client for future session verification
        // Use access token as primary key for persistence
        authenticatedSessions.set(accessToken, {
          accessToken: accessToken,
          tokenData: tokenData,
          authenticatedAt: new Date(),
          adminSessionToken: authCode.adminSessionToken, // Link to admin session
          clientId: clientId,
          persistent: true
        });
        
        // Also store by clientId for backwards compatibility
        authenticatedSessions.set(clientId, {
          accessToken: accessToken,
          tokenData: tokenData,
          authenticatedAt: new Date(),
          adminSessionToken: authCode.adminSessionToken,
          clientId: clientId,
          persistent: true
        });
        
        saveSessionData(); // Persist immediately
        
        console.log(`SUCCESS: OAuth completed for client: ${clientId}`);
        console.log(`Generated access token: ${accessToken}`);
        console.log(`Authenticated sessions now: ${authenticatedSessions.size}`);
        console.log(`Access tokens now: ${accessTokens.size}`);
        
        authCodes.delete(code);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 86400,
          scope: authCode.scope
        }));
        console.log('Token response sent successfully');
      } catch (error) {
        console.log('ERROR in token exchange:', error);
        res.writeHead(400);
        res.end('Invalid token request');
      }
    });
    return;
  }
  
  // Health check
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: 'n8n-mcp-server' }));
    return;
  }
  
  // OpenAI Plugin: /.well-known/ai-plugin.json manifest
  if (req.method === 'GET' && parsedUrl.pathname === '/.well-known/ai-plugin.json') {
    console.log('OpenAI Plugin: ai-plugin.json manifest request');
    
    const manifest = {
      schema_version: "v1",
      name_for_human: "N8N Workflows",
      name_for_model: "n8n_workflows",
      description_for_human: "Access and manage N8N workflows through AI",
      description_for_model: "Plugin for accessing N8N workflows, executions, and automation tools. Allows listing, creating, updating, executing, and managing N8N workflows.",
      auth: {
        type: "oauth",
        authorization_url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/oauth/authorize`,
        scope: "mcp"
      },
      api: {
        type: "openapi",
        url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/tools`,
        is_user_authenticated: true
      },
      logo_url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/logo.png`,
      contact_email: "admin@n8n-mcp.right-api.com",
      legal_info_url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/legal`
    };
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(manifest, null, 2));
    console.log('OpenAI Plugin: Sent ai-plugin.json manifest');
    return;
  }
  
  // OpenAI Plugin: GET /tools endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/tools') {
    console.log('OpenAI Plugin: GET /tools request');
    
    try {
      const tools = await getTools();
      const openAITools = tools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(JSON.stringify({ tools: openAITools }));
      console.log(`OpenAI Plugin: Sent ${openAITools.length} tools`);
      return;
    } catch (error) {
      console.error('Error generating OpenAI tools:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate tools' }));
      return;
    }
  }
  
  // STREAMABLE HTTP MCP ENDPOINT (2025 spec compliance)
  // RFC: All client→server messages go through /message endpoint
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/message') {
    // STREAMABLE HTTP: Proper transport negotiation per MCP 2025 spec
    const acceptHeader = req.headers.accept || '';
    const supportsSSE = acceptHeader.includes('text/event-stream');
    const supportsJSON = acceptHeader.includes('application/json');
    const userAgent = req.headers['user-agent'] || '';
    
    console.log(`STREAMABLE HTTP 2025: ${req.method} request from ${userAgent}`);
    console.log(`STREAMABLE HTTP 2025: Accept: ${acceptHeader}`);
    console.log(`STREAMABLE HTTP 2025: Transport support - SSE: ${supportsSSE}, JSON: ${supportsJSON}`);
    
    // STREAMABLE HTTP 2025: Handle GET requests for SSE upgrade
    if (req.method === 'GET') {
      console.log('STREAMABLE HTTP 2025: GET request - checking for SSE upgrade');
      
      if (supportsSSE) {
        console.log('STREAMABLE HTTP 2025: Upgrading to SSE connection');
        
        // SSE Response headers per MCP spec
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID',
          'Mcp-Transport': 'streamable-http',
          'Mcp-Protocol-Version': '2024-11-05'
        });
        
        // Send SSE connection established event
        res.write('data: {"type":"connection","status":"established"}\n\n');
        
        // STREAMABLE HTTP 2025: Send tools list as proper MCP notification
        setTimeout(async () => {
          try {
            const tools = await getTools();
            
            // Send tools as a tools/list_changed notification per MCP spec
            const toolsNotification = {
              jsonrpc: '2.0',
              method: 'notifications/tools/list_changed',
              params: {}
            };
            
            console.log(`STREAMABLE HTTP 2025: Sending tools/list_changed notification over SSE`);
            res.write(`data: ${JSON.stringify(toolsNotification)}\n\n`);
            
            // Then send tools as a proper response that Claude should pick up
            const toolsMessage = {
              jsonrpc: '2.0',
              method: 'tools/list',
              id: 'sse-auto-' + Date.now(),
              result: {
                tools: tools
              }
            };
            
            console.log(`STREAMABLE HTTP 2025: Auto-sending tools/list over SSE (${tools.length} tools)`);
            res.write(`data: ${JSON.stringify(toolsMessage)}\n\n`);
            
          } catch (err) {
            console.error('STREAMABLE HTTP 2025: Error sending tools over SSE:', err);
          }
        }, 500);
        
        // Keep connection alive
        const keepAlive = setInterval(() => {
          res.write('data: {"type":"ping"}\n\n');
        }, 30000);
        
        req.on('close', () => {
          clearInterval(keepAlive);
          console.log('STREAMABLE HTTP 2025: SSE connection closed');
        });
        
        return;
      } else {
        // GET without SSE support - return server info
        console.log('STREAMABLE HTTP 2025: GET request without SSE - returning server info');
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Mcp-Transport': 'streamable-http',
          'Mcp-Protocol-Version': '2024-11-05'
        });
        res.end(JSON.stringify({
          name: 'N8N MCP Server',
          version: '1.0.0',
          description: 'N8N Model Context Protocol Server with Streamable HTTP',
          transport: 'streamable-http',
          protocol: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            prompts: {}
          }
        }));
        return;
      }
    }
    
    // STREAMABLE HTTP 2025: Handle OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
      console.log('STREAMABLE HTTP 2025: OPTIONS preflight request');
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
        'Access-Control-Max-Age': '86400',
        'Mcp-Transport': 'streamable-http',
        'Mcp-Protocol-Version': '2024-11-05'
      });
      res.end();
      return;
    }
    
    if (req.method === 'POST') {
      // Debug all headers for POST requests
      console.log('STREAMABLE HTTP 2025: POST request headers:', JSON.stringify(req.headers, null, 2));
      
      // Check authorization for MCP requests - try Bearer token first, then session auth
      console.log('Authorization header:', req.headers.authorization);
      const sessionId = req.headers['mcp-session-id'];
      console.log('Session ID:', sessionId);
      
      let tokenData = verifyToken(req.headers.authorization);
      if (!tokenData && sessionId) {
        console.log('Bearer token not found, checking session auth...');
        tokenData = verifySessionAuth(sessionId);
      }
      
      // MCP DISCOVERY: Will check for unauthenticated discovery after body is read
      let allowUnauthenticated = false;
      
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        
        // FORCE AUTHENTICATION: No unauthenticated requests allowed
        console.log('FORCE AUTH: All requests require authentication to ensure N8N credentials are available');
        allowUnauthenticated = false;
        
        // Only check authentication after we've determined if it's a discovery request
        if (!tokenData && !allowUnauthenticated) {
          console.log('Neither Bearer token nor session auth verified - auth required for this method');
          
          console.log('No valid Bearer token or session auth - returning 401 to trigger OAuth flow');
          res.writeHead(401, { 
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="MCP Server", scope="mcp"'
          });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32001,
              message: 'Unauthorized - OAuth authentication required',
              data: {
                auth_url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/.well-known/oauth-authorization-server`
              }
            }
          }));
          return;
        } else if (tokenData) {
          console.log('Authentication verified successfully via Bearer token');
        } else {
          console.log('Proceeding with unauthenticated discovery request');
        }
        try {
          const message = JSON.parse(body);
          console.log('Received MCP message:', JSON.stringify(message, null, 2));
          
          let sessionId = req.headers['mcp-session-id'];
          if (!sessionId && message.method === 'initialize') {
            sessionId = randomUUID();
            console.log(`Created new session: ${sessionId}`);
            
            // If we have any authenticated clients and this is a new session,
            // link it to the admin session from the OAuth flow
            let mostRecentAdminToken = null;
            let mostRecentTime = 0;
            
            // First try to find admin token from persistent authenticated sessions
            if (authenticatedSessions.size > 0) {
              for (const [, authData] of authenticatedSessions.entries()) {
                console.log('Checking authenticated session:', { 
                  hasAdminToken: !!authData.adminSessionToken, 
                  authTime: authData.authenticatedAt,
                  persistent: authData.persistent,
                  tokenValid: authData.tokenData ? new Date(authData.tokenData.expiresAt) > new Date() : false
                });
                if (authData.adminSessionToken && authData.persistent && authData.tokenData && new Date(authData.tokenData.expiresAt) > new Date()) {
                  const authTime = authData.authenticatedAt.getTime();
                  if (authTime > mostRecentTime) {
                    mostRecentTime = authTime;
                    mostRecentAdminToken = authData.adminSessionToken;
                  }
                }
              }
            }
            
            // If no admin token found in authenticated sessions, check admin sessions directly
            if (!mostRecentAdminToken && adminSessions.size > 0) {
              console.log('No admin token in authenticated sessions, checking admin sessions directly');
              for (const [adminToken, adminData] of adminSessions.entries()) {
                console.log('Checking admin session:', { token: adminToken.substring(0, 8) + '...', authenticated: adminData.authenticated, hasN8N: !!(adminData.n8nHost && adminData.n8nApiKey) });
                if (adminData.authenticated && adminData.n8nHost && adminData.n8nApiKey) {
                  const createTime = adminData.createdAt.getTime();
                  if (createTime > mostRecentTime) {
                    mostRecentTime = createTime;
                    mostRecentAdminToken = adminToken;
                  }
                }
              }
            }
            
            if (mostRecentAdminToken) {
              // Store session as authenticated and link to admin session
              sessions.set(sessionId, {
                authenticated: true,
                createdAt: new Date(),
                adminSessionToken: mostRecentAdminToken
              });
              console.log(`SUCCESS: Marked session ${sessionId} as authenticated and linked to admin session ${mostRecentAdminToken.substring(0, 8)}...`);
              console.log(`Admin session N8N credentials available: ${adminSessions.get(mostRecentAdminToken)?.n8nHost ? 'YES' : 'NO'}`);
            } else {
              console.log('WARNING: No admin session with N8N credentials found - using environment variables');
              console.log(`Available admin sessions: ${adminSessions.size}`);
              console.log(`Available authenticated sessions: ${authenticatedSessions.size}`);
              if (adminSessions.size > 0) {
                console.log('Admin sessions details:');
                for (const [token, data] of adminSessions.entries()) {
                  console.log(`  Token: ${token.substring(0, 8)}..., Has N8N: ${!!(data.n8nHost && data.n8nApiKey)}, Authenticated: ${data.authenticated}`);
                }
              }
              // Store as authenticated but without admin token (will use environment variables)
              sessions.set(sessionId, {
                authenticated: true,
                createdAt: new Date()
              });
            }
          }
          
          let response;
          
          if (message.method === 'initialize') {
            // FINAL FIX: Try standard MCP format - capabilities indicate support, tools sent separately
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {
                    listChanged: true
                  },
                  prompts: {}
                },
                serverInfo: {
                  name: 'n8n-mcp-server',
                  version: '1.0.0'
                }
              }
            };
            console.log('FINAL FIX: Standard MCP initialize - Claude should request tools/list next');
          } else if (message.method === 'notifications/initialized') {
            // CRITICAL DISCOVERY FIX: Claude.ai never sends initialize, so treat this as the tools request
            console.log('CRITICAL DISCOVERY FIX: Client sent notifications/initialized - treating as tools discovery');
            
            // If no authentication, send tools but include auth requirement in response
            if (!tokenData) {
              console.log('DISCOVERY: Sending tools for unauthenticated discovery, but tools will require auth');
              const tools = await getTools();
              response = {
                jsonrpc: '2.0',
                id: message.id || 'discovery-' + Date.now(),
                result: {
                  tools: tools,
                  _auth_required: true,
                  _auth_url: `${process.env.SERVER_URL || 'https://n8n-mcp.right-api.com'}/.well-known/oauth-authorization-server`
                }
              };
              console.log(`DISCOVERY: Sent ${tools.length} tools with auth requirement:`, tools.map(t => t.name).join(', '));
            } else {
              const tools = await getTools();
              response = {
                jsonrpc: '2.0',
                id: message.id || 'discovery-' + Date.now(),
                result: {
                  tools: tools
                }
              };
              console.log(`AUTHENTICATED: Sent ${tools.length} tools:`, tools.map(t => t.name).join(', '));
            }
          } else if (message.method === 'prompts/list') {
            // HACK: Since Claude.ai only requests prompts/list and never tools/list,
            // we'll send the tools response when it asks for prompts
            console.log('HACK: Claude.ai requested prompts/list, sending tools instead!');
            const tools = await getTools();
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`HACK: Sending tools response (${tools.length} tools) to prompts/list request`);
            console.log('Tools being sent:', tools.map(t => t.name).join(', '));
          } else if (message.method === 'tools/list') {
            console.log('SUCCESS: Claude.ai is requesting tools/list!');
            const tools = await getTools();
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`SUCCESS: Sending tools response with ${tools.length} tools (unauthenticated discovery)`);
            console.log('Tools being sent:', tools.map(t => t.name).join(', '));
          } else if (message.method === 'tools/call') {
            // Get session token from authenticated sessions for N8N API access
            let sessionToken = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              console.log(`MCP Session ${sessionId} data:`, { 
                authenticated: sessionData?.authenticated, 
                hasAdminToken: !!sessionData?.adminSessionToken 
              });
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                // Use the admin session token linked to this MCP session
                sessionToken = sessionData.adminSessionToken;
                const adminSession = adminSessions.get(sessionToken);
                console.log(`SUCCESS: Using admin session token for N8N API: ${sessionToken.substring(0, 8)}...`);
                console.log(`Admin session N8N Host: ${adminSession?.n8nHost || 'NOT SET'}`);
                console.log(`Admin session API Key: ${adminSession?.n8nApiKey ? 'SET' : 'NOT SET'}`);
              } else {
                console.log('WARNING: No admin session token found for this MCP session - will use environment variables');
                console.log(`Session authenticated: ${sessionData?.authenticated}`);
                console.log(`Session has admin token: ${!!sessionData?.adminSessionToken}`);
              }
            }
            
            const result = await callTool(message.params.name, message.params.arguments || {}, sessionToken);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: result
            };
          } else {
            // ULTIMATE HACK: For any unknown method, send tools
            console.log(`ULTIMATE HACK: Unknown method '${message.method}', sending tools anyway!`);
            const tools = await getTools();
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`ULTIMATE HACK: Sent tools for method '${message.method}' - ${tools.length} tools:`, tools.map(t => t.name).join(', '));
          }
          
          // STREAMABLE HTTP 2025: Set required headers per spec
          if (message.method === 'initialize' && response.result) {
            // MCP 2025 spec: Session ID MUST be set on initialize response
            res.setHeader('Mcp-Session-Id', sessionId);
            console.log(`STREAMABLE HTTP 2025: Set Mcp-Session-Id: ${sessionId}`);
          }
          
          // MCP 2025 spec: Set transport capabilities
          res.setHeader('Mcp-Transport', 'streamable-http');
          res.setHeader('Mcp-Protocol-Version', '2024-11-05');
          
          console.log(`STREAMABLE HTTP 2025: Sending MCP response for method: ${message.method}`);
          
          // STREAMABLE HTTP 2025: Proper response headers
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
            'Mcp-Transport': 'streamable-http',
            'Mcp-Protocol-Version': '2024-11-05'
          });
          res.end(JSON.stringify(response));
          
        } catch (error) {
          console.error('Error processing MCP message:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error'
            }
          }));
        }
      });
      
    } else if (req.method === 'GET') {
      const acceptsSSE = req.headers.accept?.includes('text/event-stream') && req.headers.authorization;
      
      if (!acceptsSSE) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'N8N MCP Server',
          version: '1.0.0',
          description: 'N8N Model Context Protocol Server with OAuth 2.1',
          status: 'running',
          transport: 'Streamable HTTP',
          authorization: 'OAuth 2.1',
          specification: '2025-03-26',
          endpoints: {
            health: '/health',
            mcp: '/',
            authorization: '/oauth/authorize',
            token: '/oauth/token',
            register: '/oauth/register',
            discovery: '/.well-known/oauth-authorization-server',
            token_registration: '/tokens/register',
            token_management: '/tokens'
          }
        }));
        return;
      }
      
      // SSE streaming requires auth
      const tokenData = verifyToken(req.headers.authorization);
      if (!tokenData) {
        res.writeHead(401);
        res.end('Unauthorized');
        return;
      }
      
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId) {
        res.writeHead(400);
        res.end('Session ID required for streaming');
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
      
    } else if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId) {
        sessions.delete(sessionId);
        console.log(`Session terminated: ${sessionId}`);
      }
      res.writeHead(200);
      res.end();
    }
    
    return;
  }
  
  // Default 404
  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3007; // Use environment PORT or 3007 as fallback
console.log('Environment PORT:', process.env.PORT);
console.log('Config port:', PORT);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`N8N MCP Server (OAuth 2.1 + Streamable HTTP) running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/`);
  console.log(`OAuth discovery: http://0.0.0.0:${PORT}/.well-known/oauth-authorization-server`);
});