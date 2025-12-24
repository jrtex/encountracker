/**
 * Migration: Add monster_actions table
 * Created: 2025-12-24
 *
 * Description:
 * Creates the monster_actions table to store different types of actions that monsters can perform.
 * Supports action categories: action, legendary, special, and reaction.
 * Includes foreign key to monsters table with cascade delete.
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Creating monster_actions table');

  // Check if table already exists (idempotency)
  const tables = await database.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='monster_actions'"
  );

  if (tables.length > 0) {
    logger.debug('monster_actions table already exists, skipping');
    return;
  }

  // Create monster_actions table with indexes
  await database.exec(`
    CREATE TABLE IF NOT EXISTS monster_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monster_id INTEGER NOT NULL,
      action_category TEXT NOT NULL CHECK(action_category IN ('action', 'legendary', 'special', 'reaction')),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_monster_actions_monster ON monster_actions(monster_id);
    CREATE INDEX IF NOT EXISTS idx_monster_actions_category ON monster_actions(monster_id, action_category);
  `);

  logger.info('Successfully created monster_actions table with indexes');
}

/**
 * Rollback the migration
 * @returns {Promise<void>}
 */
async function down() {
  logger.warn('Dropping monster_actions table');

  await database.exec('DROP TABLE IF EXISTS monster_actions');

  logger.info('Dropped monster_actions table');
}

module.exports = { up, down };
