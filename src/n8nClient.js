const axios = require('axios');
const config = require('./config');

function createN8nClient(instanceId = null) {
  // Get instance configuration
  const instance = instanceId 
    ? config.getN8nInstance(instanceId)
    : config.getDefaultN8nInstance();
    
  if (!instance) {
    throw new Error(`n8n instance not found: ${instanceId || 'default'}`);
  }

  const client = axios.create({
    baseURL: instance.apiUrl,
    timeout: instance.timeout,
    headers: {
      'Authorization': instance.apiKey ? `Bearer ${instance.apiKey}` : undefined,
      'Content-Type': 'application/json',
      'User-Agent': 'n8n-MCP/1.0.0'
    },
  });

  // Add retry logic
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      if (error.response?.status >= 500 && !originalRequest._retry && originalRequest._retryCount < instance.retries) {
        originalRequest._retry = true;
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, originalRequest._retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return client(originalRequest);
      }
      
      return Promise.reject(error);
    }
  );

  return {
    // Instance info
    instanceId: instance.id,
    instanceName: instance.name,
    
    // Workflow methods
    async listWorkflows() {
      const res = await client.get('/workflows');
      return res.data;
    },
    async exportWorkflow(id) {
      const res = await client.get(`/workflows/${id}`);
      return res.data;
    },
    async importWorkflow(workflow) {
      const res = await client.post('/workflows', workflow);
      return res.data;
    },
    async updateWorkflow(id, workflow) {
      const res = await client.patch(`/workflows/${id}`, workflow);
      return res.data;
    },
    async deleteWorkflow(id) {
      const res = await client.delete(`/workflows/${id}`);
      return res.data;
    },
    async activateWorkflow(id) {
      const res = await client.post(`/workflows/${id}/activate`);
      return res.data;
    },
    async deactivateWorkflow(id) {
      const res = await client.post(`/workflows/${id}/deactivate`);
      return res.data;
    },
    async executeWorkflow(id, data = {}) {
      const res = await client.post(`/workflows/${id}/execute`, data);
      return res.data;
    },

    // Execution methods
    async listExecutions(filters = {}) {
      const params = new URLSearchParams(filters);
      const res = await client.get(`/executions?${params}`);
      return res.data;
    },
    async getExecution(id) {
      const res = await client.get(`/executions/${id}`);
      return res.data;
    },
    async deleteExecution(id) {
      const res = await client.delete(`/executions/${id}`);
      return res.data;
    },
    async retryExecution(id) {
      const res = await client.post(`/executions/${id}/retry`);
      return res.data;
    },

    // Credential methods
    async listCredentials() {
      const res = await client.get('/credentials');
      return res.data;
    },
    async getCredential(id) {
      const res = await client.get(`/credentials/${id}`);
      return res.data;
    },
    async createCredential(credential) {
      const res = await client.post('/credentials', credential);
      return res.data;
    },
    async updateCredential(id, credential) {
      const res = await client.patch(`/credentials/${id}`, credential);
      return res.data;
    },
    async deleteCredential(id) {
      const res = await client.delete(`/credentials/${id}`);
      return res.data;
    },

    // Health check
    async healthCheck() {
      const res = await client.get('/health');
      return res.data;
    }
  };
}

module.exports = createN8nClient; 