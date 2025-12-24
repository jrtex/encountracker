/**
 * Migration: Add speed column to players table
 * Created: 2025-12-24
 *
 * Description:
 * Adds a speed column to the players table with a default value of 30 feet.
 * This allows tracking player character movement speed for combat and exploration.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding speed column to players table');

  // Check if column already exists (idempotency)
  const tableInfo = await database.all('PRAGMA table_info(players)');
  const columnExists = tableInfo.some(col => col.name === 'speed');

  if (columnExists) {
    logger.debug('speed column already exists, skipping');
    return;
  }

  // Add speed column with default value of 30 (standard walking speed in D&D 5e)
  await database.run('ALTER TABLE players ADD COLUMN speed INTEGER DEFAULT 30');

  logger.info('Successfully added speed column to players table');
}

/**
 * Rollback the migration
 * Note: SQLite does not support DROP COLUMN, so this is a no-op
 * @returns {Promise<void>}
 */
async function down() {
  logger.warn('SQLite does not support DROP COLUMN - manual intervention required to rollback');
}

module.exports = { up, down };
