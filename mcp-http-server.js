import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import url from 'url';

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

// Create MCP server
function createMCPServer() {
  const server = new Server(
    {
      name: "n8n-mcp-server",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
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
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
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
  });

  return server;
}

// Create HTTP server with MCP SSE transport
const httpServer = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  if (req.method === 'GET' && req.headers.accept?.includes('text/event-stream')) {
    // SSE connection for MCP
    console.log('SSE connection established');
    const server = createMCPServer();
    const transport = new SSEServerTransport('/message', res);
    server.connect(transport);
    return;
  }
  
  if (req.method === 'POST' && parsedUrl.pathname === '/message') {
    // Handle MCP message POST
    console.log('MCP message received');
    // This will be handled by the SSE transport
    return;
  }
  
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    // Health check
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', server: 'n8n-mcp-server' }));
    return;
  }
  
  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'N8N MCP Server',
    version: '1.0.0',
    description: 'N8N Model Context Protocol Server',
    status: 'running',
    transport: 'SSE',
    endpoints: {
      health: '/health',
      mcp: 'SSE connection'
    }
  }));
});

const PORT = process.env.PORT || 3004;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`N8N MCP Server running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: SSE connection to http://0.0.0.0:${PORT}/`);
});