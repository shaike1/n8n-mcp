const jwt = require('jsonwebtoken');
const config = require('../config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  const authConfig = config.getAuth();
  
  try {
    const user = jwt.verify(token, authConfig.jwtSecret);
    req.user = user;
    req.instanceId = req.headers['x-instance-id'] || req.query.instanceId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware; 