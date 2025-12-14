const database = require('./database');
const logger = require('./logger');

async function migrateAddSpeed() {
  try {
    await database.connect();

    logger.info('Starting migration: Add speed column to players table');

    // Check if speed column already exists
    const tableInfo = await database.all('PRAGMA table_info(players)');
    const speedColumnExists = tableInfo.some(col => col.name === 'speed');

    if (speedColumnExists) {
      logger.info('Speed column already exists. Migration not needed.');
      await database.close();
      return;
    }

    // Add speed column with default value of 30
    await database.run('ALTER TABLE players ADD COLUMN speed INTEGER DEFAULT 30');

    logger.info('Successfully added speed column to players table');
    logger.info('Migration completed successfully');

    await database.close();
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAddSpeed().then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = migrateAddSpeed;
