/**
 * Migration: Add current_round column to encounters table
 * Created: 2025-12-24
 *
 * Description:
 * Adds a current_round column to the encounters table with a default value of 1.
 * This allows tracking which round of combat the encounter is currently in.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding current_round column to encounters table');

  // Check if column already exists (idempotency)
  const tableInfo = await database.all('PRAGMA table_info(encounters)');
  const columnExists = tableInfo.some(col => col.name === 'current_round');

  if (columnExists) {
    logger.debug('current_round column already exists, skipping');
    return;
  }

  // Add current_round column with default value of 1
  await database.run('ALTER TABLE encounters ADD COLUMN current_round INTEGER DEFAULT 1');

  logger.info('Successfully added current_round column to encounters table');
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
