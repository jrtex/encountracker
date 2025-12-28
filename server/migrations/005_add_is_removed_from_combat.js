/**
 * Migration: Add is_removed_from_combat column to initiative_tracker table
 * Created: 2025-12-28
 *
 * Description:
 * Adds an is_removed_from_combat column to the initiative_tracker table with a default value of false.
 * This allows DMs to temporarily remove players from combat, greying them out and skipping their turns.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding is_removed_from_combat column to initiative_tracker table');

  // Check if column already exists (idempotency)
  const tableInfo = await database.all(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?`,
    ['initiative_tracker']
  );
  const columnExists = tableInfo.some(col => col.column_name === 'is_removed_from_combat');

  if (columnExists) {
    logger.debug('is_removed_from_combat column already exists, skipping');
    return;
  }

  // Add is_removed_from_combat column with default value of false
  await database.run('ALTER TABLE initiative_tracker ADD COLUMN is_removed_from_combat BOOLEAN DEFAULT false');

  logger.info('Successfully added is_removed_from_combat column to initiative_tracker table');
}

/**
 * Rollback the migration
 * @returns {Promise<void>}
 */
async function down() {
  logger.info('Removing is_removed_from_combat column from initiative_tracker table');
  await database.run('ALTER TABLE initiative_tracker DROP COLUMN IF EXISTS is_removed_from_combat');
  logger.info('Successfully removed is_removed_from_combat column');
}

module.exports = { up, down };
