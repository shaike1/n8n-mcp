const express = require('express');
const createN8nClient = require('../n8nClient');
const cacheService = require('../services/cacheService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const workflowId = req.query.workflowId;
    
    // Check cache first
    const cachedExecutions = cacheService.getCachedExecutions(workflowId);
    if (cachedExecutions && !req.query.refresh) {
      return res.json({
        data: cachedExecutions,
        cached: true,
        count: cachedExecutions.length
      });
    }

    // Fetch from n8n if cache miss or refresh requested
    const n8n = createN8nClient(req.instanceId);
    const executions = await n8n.listExecutions();
    
    // Cache the results
    if (executions && Array.isArray(executions.data || executions)) {
      const executionsData = executions.data || executions;
      cacheService.cacheExecutions(executionsData, workflowId);
    }
    
    res.json(executions);
  } catch (err) {
    console.error('Executions fetch error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to fetch executions', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

router.delete('/:id', async (req, res) => {
  const n8n = createN8nClient(req.instanceId);
  try {
    const deleted = await n8n.deleteExecution(req.params.id);
    
    // Invalidate executions cache since we deleted one
    cacheService.invalidateCache('executions');
    
    res.json(deleted);
  } catch (err) {
    console.error('Execution delete error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to delete execution', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router; 