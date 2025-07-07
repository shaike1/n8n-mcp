const express = require('express');
const createN8nClient = require('../n8nClient');
const cacheService = require('../services/cacheService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cachedCredentials = cacheService.getCachedCredentials();
    if (cachedCredentials && !req.query.refresh) {
      return res.json({
        data: cachedCredentials,
        cached: true,
        count: cachedCredentials.length
      });
    }

    // Fetch from n8n if cache miss or refresh requested
    const n8n = createN8nClient(req.instanceId);
    const credentials = await n8n.listCredentials();
    
    // Cache the results
    if (credentials && Array.isArray(credentials.data || credentials)) {
      const credentialsData = credentials.data || credentials;
      cacheService.cacheCredentials(credentialsData);
    }
    
    res.json(credentials);
  } catch (err) {
    console.error('Credentials fetch error:', err);
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to fetch credentials', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router; 