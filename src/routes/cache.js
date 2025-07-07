const express = require('express');
const cacheService = require('../services/cacheService');

const router = express.Router();

// Get cache statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = cacheService.getCacheStats();
    res.json(stats);
  } catch (err) {
    console.error('Cache stats error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch cache statistics', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Clear specific cache
router.delete('/:key', async (req, res) => {
  try {
    cacheService.invalidateCache(req.params.key);
    res.json({ message: `Cache for '${req.params.key}' cleared successfully` });
  } catch (err) {
    console.error('Cache clear error:', err);
    res.status(500).json({ 
      error: 'Failed to clear cache', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Clear all cache
router.delete('/', async (req, res) => {
  try {
    cacheService.invalidateAllCache();
    res.json({ message: 'All cache cleared successfully' });
  } catch (err) {
    console.error('Cache clear all error:', err);
    res.status(500).json({ 
      error: 'Failed to clear all cache', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router;