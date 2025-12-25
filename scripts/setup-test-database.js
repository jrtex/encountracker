const { Client } = require('pg');
require('dotenv').config({ path: '.env.test' });

async function setupTestDatabase() {
  // First, connect to the default postgres database to create test database and user
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: 'postgres', // Connect to default database
    user: process.env.POSTGRES_ADMIN_USER || 'postgres', // Requires superuser
    password: process.env.POSTGRES_ADMIN_PASSWORD,
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL as admin');

    // Create test user if not exists
    const testUser = process.env.POSTGRES_USER;
    const testPassword = process.env.POSTGRES_PASSWORD;

    await adminClient.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${testUser}') THEN
          CREATE USER ${testUser} WITH PASSWORD '${testPassword}';
        END IF;
      END $$;
    `);
    console.log(`Created/verified test user: ${testUser}`);

    // Drop and recreate test database (ensures clean state)
    const testDb = process.env.POSTGRES_DB;
    await adminClient.query(`DROP DATABASE IF EXISTS ${testDb}`);
    console.log(`Dropped old test database: ${testDb}`);

    await adminClient.query(`CREATE DATABASE ${testDb} OWNER ${testUser}`);
    console.log(`Created test database: ${testDb}`);

    await adminClient.end();

    // Connect to test database and grant permissions
    const testClient = new Client({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT),
      database: testDb,
      user: process.env.POSTGRES_ADMIN_USER || 'postgres',
      password: process.env.POSTGRES_ADMIN_PASSWORD,
    });

    await testClient.connect();
    await testClient.query(`GRANT ALL ON SCHEMA public TO ${testUser}`);
    await testClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${testUser}`);
    await testClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${testUser}`);
    console.log('Granted permissions to test user');

    await testClient.end();

    console.log('\nTest database setup complete!');
    console.log(`Database: ${testDb}`);
    console.log(`User: ${testUser}`);
    console.log('\nYou can now run: npm test');

  } catch (error) {
    console.error('Error setting up test database:', error);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. You have superuser credentials set in environment');
    console.error('3. POSTGRES_ADMIN_PASSWORD is set (or postgres user has no password)');
    process.exit(1);
  }
}

setupTestDatabase();
