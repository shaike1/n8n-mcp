const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const workflowsRouter = require('./routes/workflows');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const executionsRouter = require('./routes/executions');
const credentialsRouter = require('./routes/credentials');
const cacheRouter = require('./routes/cache');
const instancesRouter = require('./routes/instances');

dotenv.config();

// Ensure data and logs directories exist
const dataDir = path.join(process.cwd(), 'data');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app = express();
const serverConfig = config.getServer();
const PORT = process.env.PORT || serverConfig.port;

// Request parsing
app.use(express.json({ limit: config.get('security.requestValidation.maxBodySize') }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.get('server.env'),
    version: require('../package.json').version
  });
});

// Root endpoint with configuration info
app.get('/', (req, res) => {
  res.json({ 
    status: 'MCP for n8n is running',
    config: config.getConfigInfo(),
    endpoints: {
      health: '/health',
      auth: '/auth',
      workflows: '/workflows',
      executions: '/executions', 
      credentials: '/credentials',
      cache: '/cache',
      instances: '/instances'
    }
  });
});

app.use('/auth', authRouter);
app.use('/workflows', authMiddleware, workflowsRouter);
app.use('/executions', authMiddleware, executionsRouter);
app.use('/credentials', authMiddleware, credentialsRouter);
app.use('/cache', authMiddleware, cacheRouter);
app.use('/instances', authMiddleware, instancesRouter);

app.listen(PORT, serverConfig.host, () => {
  console.log(`MCP for n8n listening on ${serverConfig.host}:${PORT}`);
  console.log(`Environment: ${config.get('server.env')}`);
  console.log(`n8n instances: ${config.getN8nInstances().length}`);
  console.log(`Default instance: ${config.getDefaultN8nInstance()?.name || 'None'}`);
}); 