const path = require('path');
const fs = require('fs');

// Load .env.test first, then .env.test.local to allow local overrides
require('dotenv').config({ path: '.env.test' });

const envTestLocalPath = path.resolve(__dirname, '..', '.env.test.local');
if (fs.existsSync(envTestLocalPath)) {
  require('dotenv').config({ path: envTestLocalPath, override: true });
}

const database = require('../server/utils/database');

module.exports = async () => {
  console.log('Setting up test database...');

  await database.connect();

  // Drop all tables to ensure clean state
  const dropTablesSQL = `
    DROP TABLE IF EXISTS initiative_tracker CASCADE;
    DROP TABLE IF EXISTS monster_actions CASCADE;
    DROP TABLE IF EXISTS monsters CASCADE;
    DROP TABLE IF EXISTS players CASCADE;
    DROP TABLE IF EXISTS encounters CASCADE;
    DROP TABLE IF EXISTS campaigns CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
  `;

  await database.exec(dropTablesSQL);
  console.log('Cleaned test database');

  // Don't close the connection - tests will reuse it and globalTeardown will close it
};
