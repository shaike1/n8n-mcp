import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config';
import { N8nWorkflow, N8nExecution } from '../types/mcp';

export class N8nClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.n8n.baseUrl,
      headers: {
        'X-N8N-API-KEY': config.n8n.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow[] }> = await this.client.get('/api/v1/workflows');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to fetch workflows: ${error}`);
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow }> = await this.client.get(`/api/v1/workflows/${id}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to fetch workflow ${id}: ${error}`);
    }
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow }> = await this.client.post('/api/v1/workflows', workflow);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error}`);
    }
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow }> = await this.client.patch(`/api/v1/workflows/${id}`, workflow);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to update workflow ${id}: ${error}`);
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/v1/workflows/${id}`);
    } catch (error) {
      throw new Error(`Failed to delete workflow ${id}: ${error}`);
    }
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow }> = await this.client.patch(`/api/v1/workflows/${id}/activate`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to activate workflow ${id}: ${error}`);
    }
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response: AxiosResponse<{ data: N8nWorkflow }> = await this.client.patch(`/api/v1/workflows/${id}/deactivate`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to deactivate workflow ${id}: ${error}`);
    }
  }

  async executeWorkflow(id: string, data?: any): Promise<N8nExecution> {
    try {
      const payload = data ? { data } : {};
      const response: AxiosResponse<{ data: N8nExecution }> = await this.client.post(`/api/v1/workflows/${id}/execute`, payload);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to execute workflow ${id}: ${error}`);
    }
  }

  async getExecutions(workflowId?: string, limit: number = 20): Promise<N8nExecution[]> {
    try {
      const params = new URLSearchParams();
      if (workflowId) params.append('workflowId', workflowId);
      params.append('limit', limit.toString());
      
      const response: AxiosResponse<{ data: N8nExecution[] }> = await this.client.get(`/api/v1/executions?${params}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to fetch executions: ${error}`);
    }
  }

  async getExecution(id: string): Promise<N8nExecution> {
    try {
      const response: AxiosResponse<{ data: N8nExecution }> = await this.client.get(`/api/v1/executions/${id}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to fetch execution ${id}: ${error}`);
    }
  }

  async stopExecution(id: string): Promise<N8nExecution> {
    try {
      const response: AxiosResponse<{ data: N8nExecution }> = await this.client.post(`/api/v1/executions/${id}/stop`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to stop execution ${id}: ${error}`);
    }
  }
}