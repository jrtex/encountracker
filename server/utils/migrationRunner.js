const fs = require('fs');
const path = require('path');
const database = require('./database');
const logger = require('./logger');

/**
 * Create the schema_migrations table if it doesn't exist
 */
async function createMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT true,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_migrations_name
      ON schema_migrations(migration_name);
  `;

  await database.exec(sql);
  logger.debug('Schema migrations table ready');
}

/**
 * Get list of migrations that have been successfully applied
 * @returns {Promise<string[]>} Array of migration names
 */
async function getAppliedMigrations() {
  const rows = await database.all(
    'SELECT migration_name FROM schema_migrations WHERE success = true ORDER BY id'
  );
  return rows.map(row => row.migration_name);
}

/**
 * Discover all migration files in the migrations directory
 * @returns {string[]} Array of migration filenames (without .js extension)
 */
function discoverMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory does not exist');
    return [];
  }

  // Read all files, filter for .js, sort alphabetically (sequential)
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort()
    .map(file => file.replace(/\.js$/, '')); // Remove .js extension

  return files;
}

/**
 * Execute a single migration
 * @param {string} migrationName - Name of the migration (without .js)
 * @returns {Promise<void>}
 */
async function executeMigration(migrationName) {
  const startTime = Date.now();
  const migrationPath = path.join(__dirname, '../migrations', `${migrationName}.js`);

  try {
    logger.info(`Running migration: ${migrationName}`);

    // Load and execute migration
    const migration = require(migrationPath);

    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${migrationName} does not export an 'up' function`);
    }

    await migration.up();

    const executionTime = Date.now() - startTime;

    // Record success
    await database.run(
      `INSERT INTO schema_migrations (migration_name, execution_time_ms, success)
       VALUES (?, ?, ?)`,
      [migrationName, executionTime, true]
    );

    logger.info(`✓ Migration completed in ${executionTime}ms: ${migrationName}`);

  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Record failure
    await database.run(
      `INSERT INTO schema_migrations (migration_name, execution_time_ms, success, error_message)
       VALUES (?, ?, ?, ?)`,
      [migrationName, executionTime, false, error.message]
    );

    // Check if migration is marked as critical (default: true)
    const migration = require(migrationPath);
    const isCritical = migration.critical !== false;

    if (isCritical) {
      throw new Error(`Critical migration failed: ${migrationName} - ${error.message}`);
    } else {
      logger.warn(`Non-critical migration failed, continuing: ${migrationName} - ${error.message}`);
    }
  }
}

/**
 * Main migration orchestrator
 * Runs all pending migrations in sequential order
 * @returns {Promise<void>}
 */
async function runMigrations() {
  try {
    logger.info('Checking for pending migrations...');

    // 1. Create migrations table if needed
    await createMigrationsTable();

    // 2. Get list of applied migrations
    const applied = await getAppliedMigrations();
    logger.debug(`Applied migrations: ${applied.length}`);

    // 3. Discover all migration files
    const allMigrations = discoverMigrations();
    logger.debug(`Total migrations found: ${allMigrations.length}`);

    // 4. Filter to get pending migrations
    const pending = allMigrations.filter(migration => !applied.includes(migration));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Found ${pending.length} pending migration(s): ${pending.join(', ')}`);

    // 5. Execute pending migrations sequentially
    for (const migrationName of pending) {
      // Re-check if migration was applied (e.g., by bootstrap)
      const currentlyApplied = await getAppliedMigrations();
      if (currentlyApplied.includes(migrationName)) {
        logger.debug(`Skipping ${migrationName} - already applied by previous migration`);
        continue;
      }

      await executeMigration(migrationName);
    }

    logger.info('All migrations completed successfully');

  } catch (error) {
    logger.error('Migration system failed:', error);
    throw error; // Prevent app startup
  }
}

module.exports = {
  runMigrations,
  createMigrationsTable,
  getAppliedMigrations,
  discoverMigrations,
  executeMigration
};
