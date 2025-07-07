const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = path.join(process.cwd(), 'data', 'cache.db');
    this.db = new Database(dbPath);
    this.createTables();
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT,
        active INTEGER,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        status TEXT,
        started_at DATETIME,
        finished_at DATETIME,
        data TEXT,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES workflows (id)
      );

      CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        expires_at DATETIME,
        last_fetch DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
      CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_metadata(expires_at);
    `);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  getDb() {
    return this.db;
  }
}

module.exports = new DatabaseManager();