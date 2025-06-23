import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';

// Create a minimal MCP server
const server = new Server(
  {
    name: "test-mcp-server", 
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Add one simple tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log('Tools list requested');
  return {
    tools: [
      {
        name: "hello",
        description: "Say hello",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log('Tool called:', request.params.name);
  return {
    content: [{
      type: "text",
      text: "Hello from MCP server!"
    }]
  };
});

// Create HTTP server
const httpServer = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'GET' && req.headers.accept?.includes('text/event-stream')) {
    console.log('Starting SSE connection');
    const transport = new SSEServerTransport('/message', res);
    await server.connect(transport);
    return;
  }
  
  if (req.method === 'POST' && req.url === '/message') {
    console.log('Handling POST message');
    // The SSE transport should handle this automatically
    // Let's try to delegate to the transport
    return;
  }
  
  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'Test MCP Server',
    status: 'running'
  }));
});

const PORT = 3005;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Test MCP Server running on port ${PORT}`);
});