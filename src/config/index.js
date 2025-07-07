const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const configSchema = require('./schema');

class ConfigService {
  constructor() {
    this.config = null;
    this.environment = process.env.NODE_ENV || 'development';
    this.configCache = new Map();
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Load default configuration
      const defaultConfig = this.loadConfigFile('default.json');
      
      // Load environment-specific configuration
      const envConfig = this.loadConfigFile(`${this.environment}.json`);
      
      // Load local overrides if they exist
      const localConfig = this.loadConfigFile('local.json', false);
      
      // Merge configurations (environment overrides default, local overrides both)
      const mergedConfig = this.deepMerge(defaultConfig, envConfig);
      const finalConfig = localConfig ? this.deepMerge(mergedConfig, localConfig) : mergedConfig;
      
      // Process environment variables
      const processedConfig = this.processEnvironmentVariables(finalConfig);
      
      // Validate configuration against schema
      const { error, value } = configSchema.validate(processedConfig, {
        allowUnknown: false,
        stripUnknown: true
      });
      
      if (error) {
        throw new Error(`Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }
      
      this.config = value;
      this.validateRequiredEnvVars();
      
      console.log(`Configuration loaded successfully for environment: ${this.environment}`);
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  loadConfigFile(filename, required = true) {
    const configPath = path.join(process.cwd(), 'config', filename);
    
    if (!fs.existsSync(configPath)) {
      if (required) {
        throw new Error(`Required configuration file not found: ${configPath}`);
      }
      return null;
    }
    
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      
      if (filename.endsWith('.json')) {
        return JSON.parse(fileContent);
      } else if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
        return yaml.load(fileContent);
      } else {
        throw new Error(`Unsupported configuration file format: ${filename}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse configuration file ${filename}: ${error.message}`);
    }
  }

  processEnvironmentVariables(config) {
    const processed = JSON.parse(JSON.stringify(config));
    this.replaceEnvVars(processed);
    return processed;
  }

  replaceEnvVars(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.replaceEnvVars(obj[key]);
      } else if (typeof obj[key] === 'string' && obj[key].startsWith('${') && obj[key].endsWith('}')) {
        const envVar = obj[key].slice(2, -1);
        const envValue = process.env[envVar];
        
        if (envValue !== undefined) {
          // Try to parse as number or boolean if possible
          if (!isNaN(envValue) && !isNaN(parseFloat(envValue))) {
            obj[key] = parseFloat(envValue);
          } else if (envValue.toLowerCase() === 'true') {
            obj[key] = true;
          } else if (envValue.toLowerCase() === 'false') {
            obj[key] = false;
          } else {
            obj[key] = envValue;
          }
        } else {
          throw new Error(`Required environment variable not found: ${envVar}`);
        }
      }
    }
  }

  validateRequiredEnvVars() {
    const requiredVars = [];
    
    // Check for production-specific requirements
    if (this.environment === 'production') {
      if (!process.env.JWT_SECRET) {
        requiredVars.push('JWT_SECRET');
      }
    }
    
    // Validate n8n instance configurations
    for (const instance of this.config.n8n.instances) {
      if (!instance.apiUrl) {
        throw new Error(`n8n instance '${instance.id}' missing required apiUrl`);
      }
    }
    
    if (requiredVars.length > 0) {
      throw new Error(`Missing required environment variables: ${requiredVars.join(', ')}`);
    }
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Getter methods with caching
  get(path, defaultValue = undefined) {
    if (this.configCache.has(path)) {
      return this.configCache.get(path);
    }
    
    const value = this.getNestedValue(this.config, path, defaultValue);
    this.configCache.set(path, value);
    return value;
  }

  getNestedValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  // Convenience getters
  getServer() { return this.get('server'); }
  getAuth() { return this.get('auth'); }
  getN8nInstances() { return this.get('n8n.instances', []); }
  getDefaultN8nInstance() { 
    const instances = this.getN8nInstances();
    const defaultId = this.get('n8n.defaultInstance', 'default');
    return instances.find(i => i.id === defaultId) || instances[0];
  }
  getN8nInstance(id) {
    return this.getN8nInstances().find(i => i.id === id);
  }
  getDatabase() { return this.get('database'); }
  getCache() { return this.get('cache'); }
  getLogging() { return this.get('logging'); }
  getSecurity() { return this.get('security'); }
  getMonitoring() { return this.get('monitoring'); }
  getFeatures() { return this.get('features'); }

  // Environment helpers
  isDevelopment() { return this.environment === 'development'; }
  isProduction() { return this.environment === 'production'; }
  isStaging() { return this.environment === 'staging'; }

  // Configuration info
  getConfigInfo() {
    return {
      environment: this.environment,
      configFile: `${this.environment}.json`,
      loadedAt: new Date().toISOString(),
      instanceCount: this.getN8nInstances().length,
      features: Object.keys(this.getFeatures()).filter(f => this.get(`features.${f}.enabled`))
    };
  }

  // Reload configuration (useful for development)
  reload() {
    this.configCache.clear();
    this.loadConfig();
  }
}

// Export singleton instance
module.exports = new ConfigService();