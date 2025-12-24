/**
 * Bootstrap Migration
 * Created: 2025-12-24
 *
 * Description:
 * This migration detects existing schema changes that were applied via manual
 * migrations and marks them as "applied" in the schema_migrations tracking table.
 * This ensures backwards compatibility with databases that had manual migrations
 * run before the automatic migration system was implemented.
 *
 * Checks for:
 * - is_active column in players table (001_add_is_active)
 * - speed column in players table (002_add_speed)
 * - current_round column in encounters table (003_add_round)
 * - monster_actions table (004_add_monster_actions)
 */

const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Apply the bootstrap migration
 * @returns {Promise<void>}
 */
async function up() {
  logger.info('Bootstrap: Checking for existing schema changes...');

  const existingMigrations = [];

  // Check if players table exists (may not exist on first run)
  const playersTables = await database.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='players'"
  );

  if (playersTables.length > 0) {
    // Players table exists, check for manually-applied migrations

    // Check for is_active column (001_add_is_active)
    const playersInfo = await database.all('PRAGMA table_info(players)');
    if (playersInfo.some(col => col.name === 'is_active')) {
      existingMigrations.push('001_add_is_active');
      logger.debug('  Found existing column: players.is_active');
    }

    // Check for speed column (002_add_speed)
    if (playersInfo.some(col => col.name === 'speed')) {
      existingMigrations.push('002_add_speed');
      logger.debug('  Found existing column: players.speed');
    }
  }

  // Check if encounters table exists
  const encountersTables = await database.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='encounters'"
  );

  if (encountersTables.length > 0) {
    // Check for current_round column (003_add_round)
    const encountersInfo = await database.all('PRAGMA table_info(encounters)');
    if (encountersInfo.some(col => col.name === 'current_round')) {
      existingMigrations.push('003_add_round');
      logger.debug('  Found existing column: encounters.current_round');
    }
  }

  // Check for monster_actions table (004_add_monster_actions)
  const monsterActionsTables = await database.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='monster_actions'"
  );
  if (monsterActionsTables.length > 0) {
    existingMigrations.push('004_add_monster_actions');
    logger.debug('  Found existing table: monster_actions');
  }

  // Mark existing migrations as applied
  if (existingMigrations.length > 0) {
    logger.info(`Bootstrap: Marking ${existingMigrations.length} migration(s) as applied`);

    for (const migrationName of existingMigrations) {
      await database.run(
        `INSERT OR IGNORE INTO schema_migrations (migration_name, execution_time_ms, success)
         VALUES (?, 0, 1)`,
        [migrationName]
      );
      logger.debug(`  Marked as applied: ${migrationName}`);
    }
  } else {
    logger.info('Bootstrap: No existing manual migrations detected (fresh install)');
  }

  logger.info('Bootstrap: Complete');
}

/**
 * Rollback the bootstrap migration
 * @returns {Promise<void>}
 */
async function down() {
  // No-op: Bootstrap doesn't modify schema, only tracking table
  logger.warn('Bootstrap rollback: No action needed');
}

module.exports = { up, down };
