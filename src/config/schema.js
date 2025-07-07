const Joi = require('joi');

const configSchema = Joi.object({
  // Server configuration
  server: Joi.object({
    port: Joi.number().port().default(3000),
    host: Joi.string().default('0.0.0.0'),
    env: Joi.string().valid('development', 'staging', 'production').default('development'),
    cors: Joi.object({
      enabled: Joi.boolean().default(true),
      origins: Joi.array().items(Joi.string()).default(['*']),
      credentials: Joi.boolean().default(true)
    }).default()
  }).default(),

  // Authentication configuration
  auth: Joi.object({
    jwtSecret: Joi.string().min(32).required(),
    jwtExpiresIn: Joi.string().default('24h'),
    bcryptRounds: Joi.number().min(10).max(15).default(12),
    sessionTimeout: Joi.number().default(86400000), // 24 hours in ms
    maxLoginAttempts: Joi.number().default(5),
    lockoutDuration: Joi.number().default(900000) // 15 minutes in ms
  }).required(),

  // n8n instances configuration
  n8n: Joi.object({
    instances: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        apiUrl: Joi.string().uri().required(),
        apiKey: Joi.string().allow('').default(''),
        webhookUrl: Joi.string().uri().allow('').default(''),
        timeout: Joi.number().default(30000),
        retries: Joi.number().default(3),
        isDefault: Joi.boolean().default(false)
      })
    ).min(1).required(),
    defaultInstance: Joi.string().default('default')
  }).required(),

  // Database configuration
  database: Joi.object({
    type: Joi.string().valid('sqlite').default('sqlite'),
    path: Joi.string().default('./data/cache.db'),
    backup: Joi.object({
      enabled: Joi.boolean().default(true),
      interval: Joi.number().default(3600000), // 1 hour in ms
      retention: Joi.number().default(168) // 1 week in hours
    }).default()
  }).default(),

  // Cache configuration
  cache: Joi.object({
    defaultTTL: Joi.number().default(300000), // 5 minutes in ms
    maxSize: Joi.number().default(1000),
    cleanupInterval: Joi.number().default(600000), // 10 minutes in ms
    strategies: Joi.object({
      workflows: Joi.object({
        ttl: Joi.number().default(300000),
        maxSize: Joi.number().default(500)
      }).default(),
      credentials: Joi.object({
        ttl: Joi.number().default(600000), // 10 minutes
        maxSize: Joi.number().default(200)
      }).default(),
      executions: Joi.object({
        ttl: Joi.number().default(180000), // 3 minutes
        maxSize: Joi.number().default(1000)
      }).default()
    }).default()
  }).default(),

  // Logging configuration
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'simple', 'combined').default('combined'),
    file: Joi.object({
      enabled: Joi.boolean().default(true),
      path: Joi.string().default('./logs'),
      maxSize: Joi.string().default('10M'),
      maxFiles: Joi.number().default(5)
    }).default(),
    console: Joi.object({
      enabled: Joi.boolean().default(true),
      colorize: Joi.boolean().default(true)
    }).default()
  }).default(),

  // Security configuration
  security: Joi.object({
    rateLimit: Joi.object({
      enabled: Joi.boolean().default(true),
      windowMs: Joi.number().default(900000), // 15 minutes
      maxRequests: Joi.number().default(100),
      skipSuccessfulRequests: Joi.boolean().default(false)
    }).default(),
    helmet: Joi.object({
      enabled: Joi.boolean().default(true),
      contentSecurityPolicy: Joi.boolean().default(false),
      crossOriginEmbedderPolicy: Joi.boolean().default(false)
    }).default(),
    requestValidation: Joi.object({
      enabled: Joi.boolean().default(true),
      maxBodySize: Joi.string().default('10mb'),
      parameterPollution: Joi.boolean().default(false)
    }).default()
  }).default(),

  // Monitoring configuration
  monitoring: Joi.object({
    healthCheck: Joi.object({
      enabled: Joi.boolean().default(true),
      interval: Joi.number().default(30000), // 30 seconds
      timeout: Joi.number().default(5000)
    }).default(),
    metrics: Joi.object({
      enabled: Joi.boolean().default(true),
      endpoint: Joi.string().default('/metrics'),
      collectDefault: Joi.boolean().default(true)
    }).default()
  }).default(),

  // Features configuration
  features: Joi.object({
    backup: Joi.object({
      enabled: Joi.boolean().default(false),
      schedule: Joi.string().default('0 2 * * *'), // Daily at 2 AM
      destinations: Joi.array().items(Joi.string()).default([])
    }).default(),
    webhooks: Joi.object({
      enabled: Joi.boolean().default(false),
      endpoint: Joi.string().default('/webhooks'),
      authentication: Joi.boolean().default(true)
    }).default(),
    apiDocs: Joi.object({
      enabled: Joi.boolean().default(true),
      endpoint: Joi.string().default('/docs'),
      title: Joi.string().default('n8n MCP API'),
      version: Joi.string().default('1.0.0')
    }).default()
  }).default()
});

module.exports = configSchema;