/**
 * Migration script to add current_round column to encounters table
 * Run with: node server/utils/migrate-add-round.js
 */

const database = require('./database');

async function migrate() {
  try {
    console.log('Starting migration: Add current_round to encounters table');

    await database.connect();

    // Check if column already exists
    const tableInfo = await database.all('PRAGMA table_info(encounters)');
    const columnExists = tableInfo.some(col => col.name === 'current_round');

    if (columnExists) {
      console.log('Column current_round already exists. Skipping migration.');
      return;
    }

    // Add current_round column
    await database.run(`
      ALTER TABLE encounters
      ADD COLUMN current_round INTEGER DEFAULT 1
    `);

    console.log('✓ Added current_round column to encounters table');
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
