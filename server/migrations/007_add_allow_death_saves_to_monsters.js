/**
 * Migration: Add allow_death_saves column to monsters table
 * Created: 2025-12-30
 *
 * Description:
 * Adds a boolean flag to determine if a monster supports death saving throws.
 * Default is false (most monsters die immediately at 0 HP).
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding allow_death_saves column to monsters table');

  // Check if column already exists (idempotency)
  const tableInfo = await database.all(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?`,
    ['monsters']
  );

  const allowDeathSavesExists = tableInfo.some(col => col.column_name === 'allow_death_saves');

  // Add allow_death_saves column
  if (!allowDeathSavesExists) {
    await database.run('ALTER TABLE monsters ADD COLUMN allow_death_saves BOOLEAN DEFAULT false');
    logger.info('Successfully added allow_death_saves column to monsters table');
  } else {
    logger.debug('allow_death_saves column already exists, skipping');
  }

  logger.info('Allow death saves migration completed successfully');
}

/**
 * Rollback the migration
 * @returns {Promise<void>}
 */
async function down() {
  logger.info('Removing allow_death_saves column from monsters table');

  await database.run('ALTER TABLE monsters DROP COLUMN IF EXISTS allow_death_saves');

  logger.info('Successfully removed allow_death_saves column');
}

module.exports = { up, down };
