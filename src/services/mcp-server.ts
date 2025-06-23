import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcError, McpTool, McpToolResult, McpServerInfo, StreamingClient } from '../types/mcp';
import { N8nClient } from './n8n-client';
import { config } from '../config';

export class McpServer extends EventEmitter {
  private n8nClient: N8nClient;
  private streamingClients: Map<string, StreamingClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  constructor() {
    super();
    this.n8nClient = new N8nClient();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      for (const [clientId, client] of this.streamingClients.entries()) {
        const timeSinceLastHeartbeat = now.getTime() - client.lastHeartbeat.getTime();
        if (timeSinceLastHeartbeat > config.mcp.streamHeartbeatInterval * 2) {
          this.removeStreamingClient(clientId);
        } else {
          this.sendToClient(clientId, { type: 'heartbeat', timestamp: now.toISOString() });
        }
      }
    }, config.mcp.streamHeartbeatInterval);
  }

  public addStreamingClient(response: any): string {
    if (this.streamingClients.size >= config.mcp.maxStreamClients) {
      throw new Error('Maximum streaming clients reached');
    }

    const clientId = uuidv4();
    this.streamingClients.set(clientId, {
      id: clientId,
      response,
      lastHeartbeat: new Date(),
    });

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    response.on('close', () => {
      this.removeStreamingClient(clientId);
    });

    this.sendToClient(clientId, { type: 'connected', clientId });
    return clientId;
  }

  public removeStreamingClient(clientId: string): void {
    const client = this.streamingClients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Client may have already disconnected
      }
      this.streamingClients.delete(clientId);
    }
  }

  private sendToClient(clientId: string, data: any): void {
    const client = this.streamingClients.get(clientId);
    if (client) {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        client.lastHeartbeat = new Date();
      } catch (error) {
        this.removeStreamingClient(clientId);
      }
    }
  }

  public broadcastToClients(data: any): void {
    for (const clientId of this.streamingClients.keys()) {
      this.sendToClient(clientId, data);
    }
  }

  public getServerInfo(): McpServerInfo {
    return {
      name: config.mcp.serverName,
      version: config.mcp.serverVersion,
    };
  }

  public getTools(): McpTool[] {
    return [
      {
        name: 'get_workflows',
        description: 'Get all N8N workflows',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_workflow',
        description: 'Get a specific N8N workflow by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_workflow',
        description: 'Create a new N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Workflow name' },
            nodes: { type: 'array', description: 'Workflow nodes' },
            connections: { type: 'object', description: 'Node connections' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Workflow tags' },
          },
          required: ['name', 'nodes', 'connections'],
        },
      },
      {
        name: 'update_workflow',
        description: 'Update an existing N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
            name: { type: 'string', description: 'Workflow name' },
            nodes: { type: 'array', description: 'Workflow nodes' },
            connections: { type: 'object', description: 'Node connections' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Workflow tags' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_workflow',
        description: 'Delete an N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'activate_workflow',
        description: 'Activate an N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'deactivate_workflow',
        description: 'Deactivate an N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'execute_workflow',
        description: 'Execute an N8N workflow',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Workflow ID' },
            data: { type: 'object', description: 'Input data for workflow execution' },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_executions',
        description: 'Get workflow execution history',
        inputSchema: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Filter by workflow ID' },
            limit: { type: 'number', description: 'Maximum number of executions to return', default: 20 },
          },
          required: [],
        },
      },
      {
        name: 'get_execution',
        description: 'Get a specific workflow execution',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Execution ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'stop_execution',
        description: 'Stop a running workflow execution',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Execution ID' },
          },
          required: ['id'],
        },
      },
    ];
  }

  public async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    console.log(`MCP Server handling request: ${request.method}`, request.params);
    
    try {
      let result: any;
      
      switch (request.method) {
        case 'initialize':
          result = this.handleInitialize();
          console.log('Initialize response:', JSON.stringify(result, null, 2));
          break;
        case 'notifications/initialized':
          result = {};
          console.log('Notifications/initialized acknowledged');
          break;
        case 'tools/list':
          result = this.handleToolsList();
          console.log('Tools list response:', JSON.stringify(result, null, 2));
          break;
        case 'tools/call':
          result = await this.handleToolsCall(request);
          break;
        default:
          console.log(`Unknown method: ${request.method}`);
          return this.createErrorResponse(request.id ?? null, -32601, 'Method not found');
      }

      const response: JsonRpcResponse = {
        jsonrpc: '2.0' as const,
        id: request.id ?? null,
        result: result,
      };
      
      return response;
    } catch (error) {
      console.error('MCP Server error:', error);
      return this.createErrorResponse(request.id ?? null, -32603, `Internal error: ${error}`);
    }
  }

  private handleInitialize(): any {
    this.initialized = true;
    return {
      protocolVersion: "2024-11-05",
      capabilities: { 
        tools: {}
      },
      serverInfo: {
        name: "n8n-mcp-server",
        version: "1.0.0"
      }
    };
  }

  private handleToolsList(): any {
    return {
      tools: this.getTools(),
    };
  }

  private async handleToolsCall(request: JsonRpcRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_workflows':
        return await this.getWorkflows();
      case 'get_workflow':
        return await this.getWorkflow(args.id);
      case 'create_workflow':
        return await this.createWorkflow(args);
      case 'update_workflow':
        return await this.updateWorkflow(args);
      case 'delete_workflow':
        return await this.deleteWorkflow(args.id);
      case 'activate_workflow':
        return await this.activateWorkflow(args.id);
      case 'deactivate_workflow':
        return await this.deactivateWorkflow(args.id);
      case 'execute_workflow':
        return await this.executeWorkflow(args.id, args.data);
      case 'get_executions':
        return await this.getExecutions(args.workflowId, args.limit);
      case 'get_execution':
        return await this.getExecution(args.id);
      case 'stop_execution':
        return await this.stopExecution(args.id);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getWorkflows(): Promise<McpToolResult> {
    const workflows = await this.n8nClient.getWorkflows();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflows, null, 2),
      }],
    };
  }

  private async getWorkflow(id: string): Promise<McpToolResult> {
    const workflow = await this.n8nClient.getWorkflow(id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      }],
    };
  }

  private async createWorkflow(args: any): Promise<McpToolResult> {
    const workflow = await this.n8nClient.createWorkflow(args);
    this.broadcastToClients({ type: 'workflow_created', workflow });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      }],
    };
  }

  private async updateWorkflow(args: any): Promise<McpToolResult> {
    const { id, ...updates } = args;
    const workflow = await this.n8nClient.updateWorkflow(id, updates);
    this.broadcastToClients({ type: 'workflow_updated', workflow });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      }],
    };
  }

  private async deleteWorkflow(id: string): Promise<McpToolResult> {
    await this.n8nClient.deleteWorkflow(id);
    this.broadcastToClients({ type: 'workflow_deleted', workflowId: id });
    return {
      content: [{
        type: 'text',
        text: `Workflow ${id} deleted successfully`,
      }],
    };
  }

  private async activateWorkflow(id: string): Promise<McpToolResult> {
    const workflow = await this.n8nClient.activateWorkflow(id);
    this.broadcastToClients({ type: 'workflow_activated', workflow });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      }],
    };
  }

  private async deactivateWorkflow(id: string): Promise<McpToolResult> {
    const workflow = await this.n8nClient.deactivateWorkflow(id);
    this.broadcastToClients({ type: 'workflow_deactivated', workflow });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflow, null, 2),
      }],
    };
  }

  private async executeWorkflow(id: string, data?: any): Promise<McpToolResult> {
    const execution = await this.n8nClient.executeWorkflow(id, data);
    this.broadcastToClients({ type: 'workflow_executed', execution });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(execution, null, 2),
      }],
    };
  }

  private async getExecutions(workflowId?: string, limit?: number): Promise<McpToolResult> {
    const executions = await this.n8nClient.getExecutions(workflowId, limit);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(executions, null, 2),
      }],
    };
  }

  private async getExecution(id: string): Promise<McpToolResult> {
    const execution = await this.n8nClient.getExecution(id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(execution, null, 2),
      }],
    };
  }

  private async stopExecution(id: string): Promise<McpToolResult> {
    const execution = await this.n8nClient.stopExecution(id);
    this.broadcastToClients({ type: 'execution_stopped', execution });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(execution, null, 2),
      }],
    };
  }

  private createErrorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
      },
    };
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const clientId of this.streamingClients.keys()) {
      this.removeStreamingClient(clientId);
    }
  }
}