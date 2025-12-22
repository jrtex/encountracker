/**
 * Migration script to add monster_actions table
 * Run with: node server/utils/migrate-add-monster-actions.js
 */

const database = require('./database');

async function migrate() {
  try {
    console.log('Starting migration: Add monster_actions table');

    await database.connect();

    // Check if table already exists
    const tableInfo = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='monster_actions'"
    );

    if (tableInfo.length > 0) {
      console.log('Table monster_actions already exists. Skipping migration.');
      return;
    }

    // Create monster_actions table
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

    console.log('✓ Created monster_actions table with indexes');
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
