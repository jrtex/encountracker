/**
 * Migration: Add is_active column to players table
 * Created: 2025-12-24
 *
 * Description:
 * Adds an is_active boolean column to the players table with a default value of true (active).
 * This allows campaigns to mark players as inactive without deleting them, preserving
 * historical data while hiding them from active encounter management.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding is_active column to players table');

  // Check if column already exists (idempotency)
  const tableInfo = await database.all(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?`,
    ['players']
  );
  const columnExists = tableInfo.some(col => col.column_name === 'is_active');

  if (columnExists) {
    logger.debug('is_active column already exists, skipping');
    return;
  }

  // Add is_active column with default value of true (active)
  await database.run('ALTER TABLE players ADD COLUMN is_active BOOLEAN DEFAULT true');

  // Update existing rows to be active by default
  const result = await database.run('UPDATE players SET is_active = true WHERE is_active IS NULL');
  logger.info(`Updated ${result.changes} existing player(s) to active status`);

  logger.info('Successfully added is_active column to players table');
}

/**
 * Rollback the migration
 * Note: PostgreSQL supports DROP COLUMN (unlike SQLite)
 * @returns {Promise<void>}
 */
async function down() {
  logger.info('Removing is_active column from players table');
  await database.run('ALTER TABLE players DROP COLUMN IF EXISTS is_active');
  logger.info('Successfully removed is_active column');
}

module.exports = { up, down };
