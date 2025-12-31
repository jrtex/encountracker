/**
 * Migration: Add death saves columns to initiative_tracker table
 * Created: 2025-12-28
 *
 * Description:
 * Adds death save tracking for D&D 5e death saving throws.
 * Players at 0 HP track successes and failures (both out of 3).
 * 3 successes = stabilized, 3 failures = dead.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Adding death saves columns to initiative_tracker table');

  // Check if columns already exist (idempotency)
  const tableInfo = await database.all(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?`,
    ['initiative_tracker']
  );

  const deathSaveSuccessesExists = tableInfo.some(col => col.column_name === 'death_save_successes');
  const deathSaveFailuresExists = tableInfo.some(col => col.column_name === 'death_save_failures');
  const isStabilizedExists = tableInfo.some(col => col.column_name === 'is_stabilized');

  // Add death_save_successes column
  if (!deathSaveSuccessesExists) {
    await database.run('ALTER TABLE initiative_tracker ADD COLUMN death_save_successes INTEGER DEFAULT 0');
    logger.info('Successfully added death_save_successes column');
  } else {
    logger.debug('death_save_successes column already exists, skipping');
  }

  // Add death_save_failures column
  if (!deathSaveFailuresExists) {
    await database.run('ALTER TABLE initiative_tracker ADD COLUMN death_save_failures INTEGER DEFAULT 0');
    logger.info('Successfully added death_save_failures column');
  } else {
    logger.debug('death_save_failures column already exists, skipping');
  }

  // Add is_stabilized column
  if (!isStabilizedExists) {
    await database.run('ALTER TABLE initiative_tracker ADD COLUMN is_stabilized BOOLEAN DEFAULT false');
    logger.info('Successfully added is_stabilized column');
  } else {
    logger.debug('is_stabilized column already exists, skipping');
  }

  logger.info('Death saves migration completed successfully');
}

/**
 * Rollback the migration
 * @returns {Promise<void>}
 */
async function down() {
  logger.info('Removing death saves columns from initiative_tracker table');

  await database.run('ALTER TABLE initiative_tracker DROP COLUMN IF EXISTS death_save_successes');
  await database.run('ALTER TABLE initiative_tracker DROP COLUMN IF EXISTS death_save_failures');
  await database.run('ALTER TABLE initiative_tracker DROP COLUMN IF EXISTS is_stabilized');

  logger.info('Successfully removed death saves columns');
}

module.exports = { up, down };
