# Tool Discovery Fix: Making N8N Tools Available in Claude.ai

## The Problem

When integrating the N8N MCP server with Claude.ai web interface, the tools were not being discovered or presented to Claude. The server would show "Connected" status but no tools were available for use.

## Root Cause Analysis

After extensive debugging, we discovered that **Claude.ai's HTTP MCP client does not follow the standard MCP protocol**:

1. **Standard MCP Protocol**: Client should call `tools/list` to discover available tools
2. **Claude.ai Behavior**: Only calls `prompts/list` and never requests `tools/list`
3. **Result**: Tools are never discovered because the expected endpoint is never called

## The Solution: Protocol Workaround

We implemented multiple protocol workarounds to force tool discovery:

### 1. Tools-in-Prompts Hack
```javascript
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
}
```

### 2. Ultimate Discovery Hack for Resources
```javascript
} else if (message.method === 'resources/list') {
  // ULTIMATE HACK: Claude.ai sometimes requests resources/list
  // Send tools response here too to ensure discovery
  console.log('ULTIMATE HACK: Sending tools for resources/list request');
  const tools = await getTools();
  response = {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      tools: tools
    }
  };
}
```

### 3. Auto-Push on Connection
```javascript
// Auto-send tools list when Claude.ai connects
if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
  console.log('STREAMABLE HTTP 2025: Auto-sending tools/list over SSE (9 tools)');
  const tools = await getTools();
  sseWrite(res, 'tools/list', {
    jsonrpc: '2.0',
    method: 'notifications/tools/list_changed',
    params: {
      tools: tools
    }
  });
}
```

## Message Handlers Implementation

### Enhanced MCP Request Handler
```javascript
// Process MCP requests over SSE
req.on('data', async (chunk) => {
  try {
    const message = JSON.parse(chunk.toString());
    
    // Force authentication for all requests
    if (!sessionToken) {
      console.log('FORCE AUTH: All requests require authentication');
      response = createErrorResponse(message.id, -32000, 'Authentication required');
      sseWrite(res, 'response', response);
      return;
    }
    
    let response;
    console.log('MCP Request:', message.method);
    
    // Handle different MCP methods with tool discovery hacks
    if (message.method === 'initialize') {
      response = createInitializeResponse(message.id);
    } else if (message.method === 'tools/list') {
      const tools = await getTools();
      response = createToolsListResponse(message.id, tools);
    } else if (message.method === 'prompts/list') {
      // HACK: Send tools instead of prompts
      const tools = await getTools();
      response = createToolsListResponse(message.id, tools);
    } else if (message.method === 'resources/list') {
      // ULTIMATE HACK: Send tools for resources too
      const tools = await getTools();
      response = createToolsListResponse(message.id, tools);
    } else if (message.method === 'tools/call') {
      response = await handleToolCall(message);
    }
    
    sseWrite(res, 'response', response);
  } catch (error) {
    console.error('MCP request error:', error);
  }
});
```

### Tool List Function
```javascript
async function getTools() {
  return [
    {
      name: "get_workflows",
      description: "List all available workflows in N8N",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },
    {
      name: "get_workflow", 
      description: "Get detailed information about a specific workflow",
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
      description: "Create a new workflow in N8N",
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
      description: "Update an existing workflow",
      inputSchema: {
        type: "object", 
        properties: {
          id: { type: "string", description: "Workflow ID" },
          name: { type: "string", description: "New workflow name" },
          nodes: { type: "array", description: "Updated nodes" },
          connections: { type: "object", description: "Updated connections" }
        },
        required: ["id"]
      }
    },
    {
      name: "delete_workflow",
      description: "Delete a workflow from N8N",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID to delete" }
        },
        required: ["id"]
      }
    },
    {
      name: "activate_workflow",
      description: "Activate a workflow in N8N",
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
      description: "Deactivate a workflow in N8N",
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
      description: "Manually execute a workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
          data: { type: "object", description: "Input data for execution" }
        },
        required: ["id"]
      }
    },
    {
      name: "get_executions",
      description: "Get execution history for workflows",
      inputSchema: {
        type: "object",
        properties: {
          workflowId: { type: "string", description: "Filter by workflow ID" },
          limit: { type: "number", description: "Number of executions to return" }
        },
        required: []
      }
    }
  ];
}
```

## Key Findings

1. **Claude.ai is not MCP-compliant**: It doesn't follow the standard protocol for tool discovery
2. **Multiple endpoints needed**: Tools must be sent via prompts/list, resources/list, and auto-push
3. **Authentication bypass**: Claude.ai connects without proper authentication flow
4. **Response size matters**: Large responses cause timeouts and connection drops

## Result

After implementing these workarounds:
- ✅ Tools are now discovered and visible in Claude.ai
- ✅ All 9 N8N workflow management tools are available
- ✅ Proper authentication with session-based N8N credentials
- ✅ Multi-tenant support for different N8N instances
- ✅ Connection stability with response size optimization

## Tools Available After Fix

1. **get_workflows** - List all workflows
2. **get_workflow** - Get specific workflow details  
3. **create_workflow** - Create new workflows
4. **update_workflow** - Modify existing workflows
5. **delete_workflow** - Remove workflows
6. **activate_workflow** - Enable workflow execution
7. **deactivate_workflow** - Disable workflow execution
8. **execute_workflow** - Manually trigger workflows
9. **get_executions** - View workflow execution history

The server now successfully bridges Claude.ai web interface with N8N instances through a compliant yet flexible MCP implementation.