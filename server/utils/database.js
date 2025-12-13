const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class Database {
  constructor() {
    this.db = null;
    this.dbType = process.env.DB_TYPE || 'sqlite';
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.dbType === 'sqlite') {
        this.connectSQLite()
          .then(resolve)
          .catch(reject);
      } else {
        // Future support for MySQL, PostgreSQL, etc.
        reject(new Error(`Database type '${this.dbType}' is not yet supported`));
      }
    });
  }

  connectSQLite() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DB_PATH || './data/database.sqlite';
      const dbDir = path.dirname(dbPath);

      // Ensure data directory exists
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info(`Created database directory: ${dbDir}`);
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Error connecting to SQLite database:', err);
          reject(err);
        } else {
          logger.info(`Connected to SQLite database at ${dbPath}`);
          // Enable foreign keys
          this.db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
              logger.error('Error enabling foreign keys:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
const database = new Database();
module.exports = database;
