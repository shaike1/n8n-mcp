const express = require('express');
const createN8nClient = require('../n8nClient');
const cacheService = require('../services/cacheService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cachedWorkflows = cacheService.getCachedWorkflows();
    if (cachedWorkflows && !req.query.refresh) {
      return res.json({
        data: cachedWorkflows,
        cached: true,
        count: cachedWorkflows.length
      });
    }

    // Fetch from n8n if cache miss or refresh requested
    const n8n = createN8nClient(req.instanceId);
    const workflows = await n8n.listWorkflows();
    
    // Cache the results
    if (workflows && Array.isArray(workflows.data || workflows)) {
      const workflowsData = workflows.data || workflows;
      cacheService.cacheWorkflows(workflowsData);
    }
    
    res.json({
      ...workflows,
      instanceId: n8n.instanceId,
      instanceName: n8n.instanceName
    });
  } catch (err) {
    console.error('Workflow fetch error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to fetch workflows', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    // Check cache first
    const cachedWorkflow = cacheService.getCachedWorkflow(req.params.id);
    if (cachedWorkflow && !req.query.refresh) {
      return res.json({
        ...cachedWorkflow,
        cached: true
      });
    }

    // Fetch from n8n if cache miss or refresh requested
    const n8n = createN8nClient(req.instanceId);
    const workflow = await n8n.exportWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('Workflow export error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to export workflow', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

router.post('/', async (req, res) => {
  const n8n = createN8nClient(req.instanceId);
  try {
    const imported = await n8n.importWorkflow(req.body);
    
    // Invalidate workflows cache since we added a new one
    cacheService.invalidateCache('workflows');
    
    res.status(201).json(imported);
  } catch (err) {
    console.error('Workflow import error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to import workflow', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

router.delete('/:id', async (req, res) => {
  const n8n = createN8nClient(req.instanceId);
  try {
    const deleted = await n8n.deleteWorkflow(req.params.id);
    
    // Invalidate workflows cache since we deleted one
    cacheService.invalidateCache('workflows');
    
    res.json(deleted);
  } catch (err) {
    console.error('Workflow delete error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to delete workflow', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router; 