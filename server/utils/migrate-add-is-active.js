const database = require('./database');
const logger = require('./logger');

async function migrateAddIsActive() {
  try {
    await database.connect();

    logger.info('Starting migration: Add is_active column to players table');

    // Check if is_active column already exists
    const tableInfo = await database.all('PRAGMA table_info(players)');
    const isActiveColumnExists = tableInfo.some(col => col.name === 'is_active');

    if (isActiveColumnExists) {
      logger.info('is_active column already exists. Migration not needed.');
      await database.close();
      return;
    }

    // Add is_active column with default value of 1 (active)
    await database.run('ALTER TABLE players ADD COLUMN is_active BOOLEAN DEFAULT 1');

    logger.info('Successfully added is_active column to players table');

    // Update existing rows to be active by default
    const result = await database.run('UPDATE players SET is_active = 1 WHERE is_active IS NULL');
    logger.info(`Updated ${result.changes} existing player(s) to active status`);

    logger.info('Migration completed successfully');

    await database.close();
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAddIsActive().then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = migrateAddIsActive;
