const express = require('express');
const config = require('../config');
const createN8nClient = require('../n8nClient');

const router = express.Router();

// List all configured n8n instances
router.get('/', async (req, res) => {
  try {
    const instances = config.getN8nInstances();
    const instancesWithStatus = await Promise.allSettled(
      instances.map(async (instance) => {
        try {
          const client = createN8nClient(instance.id);
          const health = await client.healthCheck();
          return {
            ...instance,
            status: 'healthy',
            health,
            lastChecked: new Date().toISOString()
          };
        } catch (error) {
          return {
            ...instance,
            status: 'unhealthy',
            error: error.message,
            lastChecked: new Date().toISOString()
          };
        }
      })
    );

    const result = instancesWithStatus.map((result, index) => ({
      ...instances[index],
      ...(result.status === 'fulfilled' ? result.value : {
        status: 'error',
        error: result.reason?.message || 'Unknown error',
        lastChecked: new Date().toISOString()
      })
    }));

    res.json({
      instances: result,
      defaultInstance: config.get('n8n.defaultInstance'),
      total: instances.length
    });
  } catch (err) {
    console.error('Instance list error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch instances', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Get specific instance details
router.get('/:instanceId', async (req, res) => {
  try {
    const instance = config.getN8nInstance(req.params.instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    try {
      const client = createN8nClient(instance.id);
      const health = await client.healthCheck();
      
      res.json({
        ...instance,
        status: 'healthy',
        health,
        lastChecked: new Date().toISOString()
      });
    } catch (error) {
      res.json({
        ...instance,
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Instance details error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch instance details', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Test instance connection
router.post('/:instanceId/test', async (req, res) => {
  try {
    const instance = config.getN8nInstance(req.params.instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const client = createN8nClient(instance.id);
    const startTime = Date.now();
    
    try {
      const health = await client.healthCheck();
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        instanceId: instance.id,
        instanceName: instance.name,
        responseTime,
        health,
        testedAt: new Date().toISOString()
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      res.status(503).json({
        success: false,
        instanceId: instance.id,
        instanceName: instance.name,
        responseTime,
        error: error.message,
        testedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Instance test error:', err);
    res.status(500).json({ 
      error: 'Failed to test instance', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Execute workflow on specific instance
router.post('/:instanceId/workflows/:workflowId/execute', async (req, res) => {
  try {
    const instance = config.getN8nInstance(req.params.instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const client = createN8nClient(instance.id);
    const execution = await client.executeWorkflow(req.params.workflowId, req.body);
    
    res.json({
      ...execution,
      instanceId: instance.id,
      instanceName: instance.name
    });
  } catch (err) {
    console.error('Workflow execution error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to execute workflow', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Get workflows from specific instance
router.get('/:instanceId/workflows', async (req, res) => {
  try {
    const instance = config.getN8nInstance(req.params.instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const client = createN8nClient(instance.id);
    const workflows = await client.listWorkflows();
    
    res.json({
      ...workflows,
      instanceId: instance.id,
      instanceName: instance.name
    });
  } catch (err) {
    console.error('Instance workflows error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to fetch workflows from instance', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router;