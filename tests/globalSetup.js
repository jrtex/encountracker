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

  await database.close();
};
