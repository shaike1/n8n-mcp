import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// N8N Configuration
const N8N_HOST = process.env.N8N_HOST || 'https://app.right-api.com';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyODQwYzIzMC04NTE4LTRhZWEtYmM4OC0zNTk1MjhiMDQ5MDgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQ3Mjg5NjIwfQ.dclIQI4D7-3udOfM_s2A2SHUbEGTM_7D3jneWtQj5NY';

// Simple N8N API client
async function n8nRequest(endpoint, options = {}) {
  const url = `${N8N_HOST}/api/v1${endpoint}`;
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
        
      case "activate_workflow":
        const activated = await n8nRequest(`/workflows/${args.id}/activate`, { method: 'POST' });
        return {
          content: [{
            type: "text",
            text: `Workflow ${args.id} activated successfully`
          }]
        };
        
      case "deactivate_workflow":
        const deactivated = await n8nRequest(`/workflows/${args.id}/deactivate`, { method: 'POST' });
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("N8N MCP Server running on stdio");
}

main().catch(console.error);