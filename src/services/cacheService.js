const dbManager = require('../database/db');

class CacheService {
  constructor() {
    this.db = dbManager.getDb();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  isExpired(cacheKey) {
    const stmt = this.db.prepare('SELECT expires_at FROM cache_metadata WHERE key = ?');
    const result = stmt.get(cacheKey);
    
    if (!result) return true;
    
    const expiresAt = new Date(result.expires_at);
    return new Date() > expiresAt;
  }

  setCacheMetadata(key, ttl = this.defaultTTL) {
    const expiresAt = new Date(Date.now() + ttl);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache_metadata (key, expires_at, last_fetch) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(key, expiresAt.toISOString());
  }

  // Workflow caching
  cacheWorkflows(workflows) {
    const transaction = this.db.transaction((workflows) => {
      const deleteStmt = this.db.prepare('DELETE FROM workflows');
      const insertStmt = this.db.prepare(`
        INSERT INTO workflows (id, name, active, data, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      deleteStmt.run();
      
      for (const workflow of workflows) {
        insertStmt.run(
          workflow.id,
          workflow.name,
          workflow.active ? 1 : 0,
          JSON.stringify(workflow),
          workflow.createdAt,
          workflow.updatedAt
        );
      }
    });
    
    transaction(workflows);
    this.setCacheMetadata('workflows');
  }

  getCachedWorkflows() {
    if (this.isExpired('workflows')) {
      return null;
    }
    
    const stmt = this.db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC');
    const rows = stmt.all();
    
    return rows.map(row => ({
      ...JSON.parse(row.data),
      cached: true,
      cachedAt: row.cached_at
    }));
  }

  getCachedWorkflow(id) {
    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;
    
    return {
      ...JSON.parse(row.data),
      cached: true,
      cachedAt: row.cached_at
    };
  }

  // Credentials caching
  cacheCredentials(credentials) {
    const transaction = this.db.transaction((credentials) => {
      const deleteStmt = this.db.prepare('DELETE FROM credentials');
      const insertStmt = this.db.prepare(`
        INSERT INTO credentials (id, name, type, data, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      deleteStmt.run();
      
      for (const credential of credentials) {
        insertStmt.run(
          credential.id,
          credential.name,
          credential.type,
          JSON.stringify(credential),
          credential.createdAt,
          credential.updatedAt
        );
      }
    });
    
    transaction(credentials);
    this.setCacheMetadata('credentials');
  }

  getCachedCredentials() {
    if (this.isExpired('credentials')) {
      return null;
    }
    
    const stmt = this.db.prepare('SELECT * FROM credentials ORDER BY updated_at DESC');
    const rows = stmt.all();
    
    return rows.map(row => ({
      ...JSON.parse(row.data),
      cached: true,
      cachedAt: row.cached_at
    }));
  }

  // Executions caching
  cacheExecutions(executions, workflowId = null) {
    const transaction = this.db.transaction((executions) => {
      const deleteStmt = workflowId 
        ? this.db.prepare('DELETE FROM executions WHERE workflow_id = ?')
        : this.db.prepare('DELETE FROM executions');
      const insertStmt = this.db.prepare(`
        INSERT INTO executions (id, workflow_id, status, started_at, finished_at, data) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      if (workflowId) {
        deleteStmt.run(workflowId);
      } else {
        deleteStmt.run();
      }
      
      for (const execution of executions) {
        insertStmt.run(
          execution.id,
          execution.workflowId,
          execution.status,
          execution.startedAt,
          execution.finishedAt,
          JSON.stringify(execution)
        );
      }
    });
    
    transaction(executions);
    const cacheKey = workflowId ? `executions_${workflowId}` : 'executions';
    this.setCacheMetadata(cacheKey);
  }

  getCachedExecutions(workflowId = null) {
    const cacheKey = workflowId ? `executions_${workflowId}` : 'executions';
    
    if (this.isExpired(cacheKey)) {
      return null;
    }
    
    const stmt = workflowId
      ? this.db.prepare('SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC')
      : this.db.prepare('SELECT * FROM executions ORDER BY started_at DESC');
    
    const rows = workflowId ? stmt.all(workflowId) : stmt.all();
    
    return rows.map(row => ({
      ...JSON.parse(row.data),
      cached: true,
      cachedAt: row.cached_at
    }));
  }

  // Cache invalidation
  invalidateCache(key) {
    const stmt = this.db.prepare('DELETE FROM cache_metadata WHERE key = ?');
    stmt.run(key);
  }

  invalidateAllCache() {
    this.db.exec('DELETE FROM cache_metadata');
  }

  // Cache statistics
  getCacheStats() {
    const stats = {
      workflows: this.db.prepare('SELECT COUNT(*) as count FROM workflows').get(),
      credentials: this.db.prepare('SELECT COUNT(*) as count FROM credentials').get(),
      executions: this.db.prepare('SELECT COUNT(*) as count FROM executions').get(),
      cacheEntries: this.db.prepare('SELECT COUNT(*) as count FROM cache_metadata').get()
    };
    
    return {
      workflows: stats.workflows.count,
      credentials: stats.credentials.count,
      executions: stats.executions.count,
      cacheEntries: stats.cacheEntries.count
    };
  }
}

module.exports = new CacheService();