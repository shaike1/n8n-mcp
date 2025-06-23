import http from 'http';
import url from 'url';
import { randomUUID, createHash } from 'crypto';

// N8N Configuration - Will be set per session via login form
let N8N_HOST = process.env.N8N_BASE_URL || process.env.N8N_HOST || '';
let N8N_API_KEY = process.env.N8N_API_KEY || '';

console.log('N8N Configuration:');
console.log('N8N_HOST:', N8N_HOST || 'Will be configured via login form');
console.log('N8N_API_KEY:', N8N_API_KEY ? `${N8N_API_KEY.substring(0, 20)}...` : 'Will be configured via login form');

// OAuth storage
const clients = new Map();
const authCodes = new Map();
const accessTokens = new Map();
const sessions = new Map();
const authenticatedSessions = new Map(); // Track OAuth-authenticated sessions

// Admin authentication - hardcoded for testing
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'a0506a70dbaf3486014ceac508d7db2d7607fba8';
const adminSessions = new Map(); // Track authenticated admin sessions

console.log('Admin Authentication:');
console.log('Username:', ADMIN_USERNAME);
console.log('Password:', ADMIN_PASSWORD ? '***SET***' : 'NOT SET - USING DEFAULT');

// Generate admin session token with N8N connection details
function createAdminSession(n8nHost, n8nApiKey) {
  const sessionToken = randomUUID();
  const sessionData = {
    authenticated: true,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    n8nHost: n8nHost,
    n8nApiKey: n8nApiKey
  };
  adminSessions.set(sessionToken, sessionData);
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
  const response = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': n8nApiKey,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`N8N API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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
  
  try {
    switch (name) {
      case "get_workflows":
        const workflows = await n8nRequest('/workflows', {}, sessionToken);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(workflows, null, 2)
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
      issuer: 'https://n8n-mcp.right-api.com',
      authorization_endpoint: 'https://n8n-mcp.right-api.com/oauth/authorize',
      token_endpoint: 'https://n8n-mcp.right-api.com/oauth/token',
      registration_endpoint: 'https://n8n-mcp.right-api.com/oauth/register',
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
          resource: 'https://n8n-mcp.right-api.com',
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
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          resource: 'https://n8n-mcp.right-api.com'
        };
        accessTokens.set(accessToken, tokenData);
        
        // Store authenticated client for future session verification
        authenticatedSessions.set(clientId, {
          accessToken: accessToken,
          tokenData: tokenData,
          authenticatedAt: new Date(),
          adminSessionToken: authCode.adminSessionToken // Link to admin session
        });
        
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
  
  // MCP endpoint (Streamable HTTP with OAuth)
  if (parsedUrl.pathname === '/') {
    if (req.method === 'POST') {
      // Debug all headers
      console.log('All headers:', JSON.stringify(req.headers, null, 2));
      
      // Check authorization for MCP requests - try Bearer token first, then session auth
      console.log('Authorization header:', req.headers.authorization);
      const sessionId = req.headers['mcp-session-id'];
      console.log('Session ID:', sessionId);
      
      let tokenData = verifyToken(req.headers.authorization);
      if (!tokenData && sessionId) {
        console.log('Bearer token not found, checking session auth...');
        tokenData = verifySessionAuth(sessionId);
      }
      
      if (!tokenData) {
        console.log('Neither Bearer token nor session auth verified');
        // For Claude.ai web, allow MCP requests if we have any recent OAuth completions
        // This handles the case where Claude.ai completes OAuth but doesn't send auth headers in MCP requests
        const recentAuthTime = 5 * 60 * 1000; // 5 minutes
        const hasRecentAuth = Array.from(authenticatedSessions.values()).some(auth => 
          new Date() - auth.authenticatedAt < recentAuthTime
        );
        
        console.log(`Authenticated sessions count: ${authenticatedSessions.size}`);
        console.log(`Access tokens count: ${accessTokens.size}`);
        if (authenticatedSessions.size > 0) {
          const sessions = Array.from(authenticatedSessions.entries());
          console.log('Recent auth sessions:', sessions.map(([id, data]) => ({
            clientId: id,
            authenticatedAt: data.authenticatedAt,
            ageMinutes: (new Date() - data.authenticatedAt) / (1000 * 60)
          })));
        }
        
        if (hasRecentAuth) {
          console.log('Allowing request due to recent OAuth completion');
        } else {
          console.log('No recent OAuth completion - returning 401 to trigger OAuth flow');
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
                auth_url: 'https://n8n-mcp.right-api.com/.well-known/oauth-authorization-server'
              }
            }
          }));
          return;
        }
      } else {
        console.log('Authentication verified successfully via Bearer token');
      }
      
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          console.log('Received MCP message:', JSON.stringify(message, null, 2));
          
          let sessionId = req.headers['mcp-session-id'];
          if (!sessionId && message.method === 'initialize') {
            sessionId = randomUUID();
            console.log(`Created new session: ${sessionId}`);
            
            // If we have any authenticated clients and this is a new session,
            // link it to the admin session from the OAuth flow
            if (authenticatedSessions.size > 0) {
              // Find the most recent authenticated session with admin token
              let mostRecentAdminToken = null;
              let mostRecentTime = 0;
              
              for (const [, authData] of authenticatedSessions.entries()) {
                if (authData.adminSessionToken) {
                  const authTime = authData.authenticatedAt.getTime();
                  if (authTime > mostRecentTime) {
                    mostRecentTime = authTime;
                    mostRecentAdminToken = authData.adminSessionToken;
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
                console.log(`Marked session ${sessionId} as authenticated and linked to admin session ${mostRecentAdminToken.substring(0, 8)}...`);
              } else {
                console.log('No authenticated session with admin token found');
              }
            }
          }
          
          let response;
          
          if (message.method === 'initialize') {
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {
                    listChanged: false
                  },
                  prompts: {}
                },
                serverInfo: {
                  name: 'n8n-mcp-server',
                  version: '1.0.0'
                }
              }
            };
            console.log('Sending initialize response with tools capability');
          } else if (message.method === 'notifications/initialized') {
            // No response needed for notifications
            console.log('Client initialized notification received');
            return;
          } else if (message.method === 'prompts/list') {
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                prompts: []
              }
            };
            console.log('Sending empty prompts response');
          } else if (message.method === 'tools/list') {
            const tools = await getTools();
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
            console.log(`Sending tools response with ${tools.length} tools`);
          } else if (message.method === 'tools/call') {
            // Get session token from authenticated sessions for N8N API access
            let sessionToken = null;
            if (sessionId) {
              const sessionData = sessions.get(sessionId);
              if (sessionData && sessionData.authenticated && sessionData.adminSessionToken) {
                // Use the admin session token linked to this MCP session
                sessionToken = sessionData.adminSessionToken;
                console.log(`Using admin session token for N8N API: ${sessionToken.substring(0, 8)}...`);
              } else {
                console.log('No admin session token found for this MCP session');
              }
            }
            
            const result = await callTool(message.params.name, message.params.arguments || {}, sessionToken);
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: result
            };
          } else {
            response = {
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32601,
                message: 'Method not found'
              }
            };
          }
          
          if (message.method === 'initialize' && response.result) {
            res.setHeader('Mcp-Session-Id', sessionId);
          }
          
          console.log(`Sending MCP response for method: ${message.method}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
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