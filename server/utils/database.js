const { Pool } = require('pg');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'encountracker',
      user: process.env.POSTGRES_USER || 'encountracker_user',
      password: process.env.POSTGRES_PASSWORD,
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(config);

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
      logger.info(`Connected to PostgreSQL at ${config.host}:${config.port}/${config.database}`);
    } finally {
      client.release();
    }
  }

  /**
   * Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ... placeholders
   * @param {string} sql - SQL query with ? placeholders
   * @returns {string} SQL query with $N placeholders
   */
  convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  /**
   * Execute INSERT, UPDATE, or DELETE query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<{lastID: number|null, changes: number}>}
   */
  async run(sql, params = []) {
    const convertedSql = this.convertPlaceholders(sql);

    // If INSERT query, add RETURNING id if not present
    let finalSql = convertedSql;
    if (/^\s*INSERT/i.test(convertedSql) && !/RETURNING/i.test(convertedSql)) {
      finalSql = convertedSql.replace(/;?\s*$/, ' RETURNING id');
    }

    const result = await this.pool.query(finalSql, params);

    return {
      lastID: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  }

  /**
   * Fetch a single row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|undefined>}
   */
  async get(sql, params = []) {
    const convertedSql = this.convertPlaceholders(sql);
    const result = await this.pool.query(convertedSql, params);
    return result.rows[0] || undefined;
  }

  /**
   * Fetch multiple rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async all(sql, params = []) {
    const convertedSql = this.convertPlaceholders(sql);
    const result = await this.pool.query(convertedSql, params);
    return result.rows;
  }

  /**
   * Execute raw SQL (supports multiple statements)
   * @param {string} sql - SQL statements
   * @returns {Promise<void>}
   */
  async exec(sql) {
    // PostgreSQL doesn't support multi-statement in single query by default
    // Split on semicolons and execute sequentially
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await this.pool.query(statement);
      }
    }
  }

  /**
   * Close database connection pool
   * @returns {Promise<void>}
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('PostgreSQL connection pool closed');
    }
  }
}

// Export singleton instance
const database = new Database();
module.exports = database;
