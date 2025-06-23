import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { randomUUID } from 'crypto';

// N8N Configuration
const N8N_HOST = process.env.N8N_HOST || 'https://app.right-api.com';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyODQwYzIzMC04NTE4LTRhZWEtYmM4OC0zNTk1MjhiMDQ5MDgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQ3Mjg5NjIwfQ.dclIQI4D7-3udOfM_s2A2SHUbEGTM_7D3jneWtQj5NY';

// Simple N8N API client
async function n8nRequest(endpoint, options = {}) {
  const url = `${N8N_HOST}/api/v1${endpoint}`;
  
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${N8N_API_KEY}`,
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

// Session management
const sessions = new Map();

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

// Call a tool
async function callTool(name, args) {
  console.log(`Tool called: ${name}`);
  
  try {
    switch (name) {
      case "get_workflows":
        const workflows = await n8nRequest('/workflows');
        return {
          content: [{
            type: "text",
            text: JSON.stringify(workflows, null, 2)
          }]
        };
        
      case "get_workflow":
        const workflow = await n8nRequest(`/workflows/${args.id}`);
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
        });
        return {
          content: [{
            type: "text",
            text: `Workflow created successfully: ${JSON.stringify(created, null, 2)}`
          }]
        };
        
      case "activate_workflow":
        await n8nRequest(`/workflows/${args.id}/activate`, { method: 'POST' });
        return {
          content: [{
            type: "text",
            text: `Workflow ${args.id} activated successfully`
          }]
        };
        
      case "deactivate_workflow":
        await n8nRequest(`/workflows/${args.id}/deactivate`, { method: 'POST' });
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
        });
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
        const executions = await n8nRequest(execEndpoint);
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


// Streamable HTTP MCP server
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
  
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: 'n8n-mcp-server' }));
    return;
  }
  
  // MCP endpoint (Streamable HTTP)
  if (req.url === '/') {
    if (req.method === 'POST') {
      // Handle JSON-RPC message
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          console.log('Received MCP message:', JSON.stringify(message, null, 2));
          
          // Get or create session
          let sessionId = req.headers['mcp-session-id'];
          if (!sessionId && message.method === 'initialize') {
            sessionId = randomUUID();
            console.log(`Created new session: ${sessionId}`);
          }
          
          // Handle different MCP methods directly
          let response;
          
          if (message.method === 'initialize') {
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: {}
                },
                serverInfo: {
                  name: 'n8n-mcp-server',
                  version: '1.0.0'
                }
              }
            };
          } else if (message.method === 'tools/list') {
            const tools = await getTools();
            response = {
              jsonrpc: '2.0',
              id: message.id,
              result: {
                tools: tools
              }
            };
          } else if (message.method === 'tools/call') {
            const result = await callTool(message.params.name, message.params.arguments || {});
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
          
          // Add session ID to initialize response
          if (message.method === 'initialize' && response.result) {
            res.setHeader('Mcp-Session-Id', sessionId);
          }
          
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
      // Handle SSE streaming (optional) or server info
      const sessionId = req.headers['mcp-session-id'];
      const acceptsSSE = req.headers.accept?.includes('text/event-stream');
      
      if (acceptsSSE && !sessionId) {
        res.writeHead(400);
        res.end('Session ID required for streaming');
        return;
      }
      
      if (!acceptsSSE) {
        // Return server info for regular GET requests
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'N8N MCP Server',
          version: '1.0.0',
          description: 'N8N Model Context Protocol Server',
          status: 'running',
          transport: 'Streamable HTTP',
          specification: '2025-03-26',
          endpoints: {
            health: '/health',
            mcp: '/'
          }
        }));
        return;
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Send keep-alive
      const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
      });
      
    } else if (req.method === 'DELETE') {
      // Terminate session
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
  
  // Default response with server info
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'N8N MCP Server',
    version: '1.0.0',
    description: 'N8N Model Context Protocol Server',
    status: 'running',
    transport: 'Streamable HTTP',
    specification: '2025-03-26',
    endpoints: {
      health: '/health',
      mcp: '/'
    }
  }));
});

const PORT = process.env.PORT || 3004;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`N8N MCP Server (Streamable HTTP) running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/`);
});