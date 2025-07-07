# Configuration Management

This project uses a hierarchical configuration system with environment-specific overrides and validation.

## Configuration Files

### File Priority (highest to lowest)
1. `local.json` - Local overrides (not tracked in git)
2. `{environment}.json` - Environment-specific config
3. `default.json` - Base configuration

### Environment Files
- `default.json` - Base configuration for all environments
- `development.json` - Development environment overrides
- `staging.json` - Staging environment overrides  
- `production.json` - Production environment overrides
- `local.json` - Local overrides (create manually, ignored by git)

## Environment Variables

Environment variables can be referenced in config files using `${VARIABLE_NAME}` syntax.

### Required for Production
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)

### Optional
- `NODE_ENV` - Environment name (development, staging, production)
- `PORT` - Server port override
- `HOST` - Server host override

## Configuration Schema

The configuration is validated against a Joi schema with the following structure:

### Server Configuration
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "env": "development",
    "cors": {
      "enabled": true,
      "origins": ["*"],
      "credentials": true
    }
  }
}
```

### Authentication Configuration
```json
{
  "auth": {
    "jwtSecret": "${JWT_SECRET}",
    "jwtExpiresIn": "24h",
    "bcryptRounds": 12,
    "sessionTimeout": 86400000,
    "maxLoginAttempts": 5,
    "lockoutDuration": 900000
  }
}
```

### n8n Instances Configuration
```json
{
  "n8n": {
    "instances": [
      {
        "id": "default",
        "name": "Default n8n Instance",
        "apiUrl": "http://localhost:5678/api/v1",
        "apiKey": "",
        "webhookUrl": "",
        "timeout": 30000,
        "retries": 3,
        "isDefault": true
      }
    ],
    "defaultInstance": "default"
  }
}
```

### Database Configuration
```json
{
  "database": {
    "type": "sqlite",
    "path": "./data/cache.db",
    "backup": {
      "enabled": true,
      "interval": 3600000,
      "retention": 168
    }
  }
}
```

### Cache Configuration
```json
{
  "cache": {
    "defaultTTL": 300000,
    "maxSize": 1000,
    "cleanupInterval": 600000,
    "strategies": {
      "workflows": {
        "ttl": 300000,
        "maxSize": 500
      },
      "credentials": {
        "ttl": 600000,
        "maxSize": 200
      },
      "executions": {
        "ttl": 180000,
        "maxSize": 1000
      }
    }
  }
}
```

### Security Configuration
```json
{
  "security": {
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "maxRequests": 100,
      "skipSuccessfulRequests": false
    },
    "helmet": {
      "enabled": true,
      "contentSecurityPolicy": false,
      "crossOriginEmbedderPolicy": false
    },
    "requestValidation": {
      "enabled": true,
      "maxBodySize": "10mb",
      "parameterPollution": false
    }
  }
}
```

## Usage Examples

### Multiple n8n Instances
```json
{
  "n8n": {
    "instances": [
      {
        "id": "production",
        "name": "Production n8n",
        "apiUrl": "https://n8n.production.com/api/v1",
        "apiKey": "${PROD_N8N_API_KEY}",
        "isDefault": true
      },
      {
        "id": "staging", 
        "name": "Staging n8n",
        "apiUrl": "https://n8n.staging.com/api/v1",
        "apiKey": "${STAGING_N8N_API_KEY}"
      }
    ],
    "defaultInstance": "production"
  }
}
```

### Accessing Specific Instance
```bash
# Via header
curl -H "X-Instance-ID: staging" /workflows

# Via query parameter  
curl /workflows?instanceId=staging
```

### Environment-Specific Settings
```json
// production.json
{
  "logging": {
    "level": "warn",
    "format": "json"
  },
  "security": {
    "rateLimit": {
      "maxRequests": 50
    }
  },
  "features": {
    "apiDocs": {
      "enabled": false
    }
  }
}
```

## Configuration API

### Get Configuration Info
```bash
GET /
```

### Get Cache Statistics  
```bash
GET /cache/stats
```

### List n8n Instances
```bash
GET /instances
```

### Test Instance Connection
```bash
POST /instances/{instanceId}/test
```

## Validation

Configuration is validated at startup using Joi schema. Invalid configurations will prevent the application from starting with detailed error messages.

Common validation errors:
- Missing required fields
- Invalid data types
- Invalid enum values
- Missing environment variables in production

## Best Practices

1. **Never commit secrets** - Use environment variables for sensitive data
2. **Use local.json for development** - Override settings without affecting git
3. **Validate configurations** - Test with different environments
4. **Document custom settings** - Add comments for non-obvious configurations
5. **Use meaningful instance IDs** - Make them descriptive and consistent