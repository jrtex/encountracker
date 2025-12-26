const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables: .env.test.local first (if exists), then .env.test
const envTestLocalPath = path.resolve(__dirname, '..', '.env.test.local');
if (fs.existsSync(envTestLocalPath)) {
  require('dotenv').config({ path: envTestLocalPath });
}
require('dotenv').config({ path: '.env.test' });

// Helper function to prompt for password
function promptForPassword() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Hide password input
    const stdin = process.openStdin();
    process.stdin.on('data', char => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.pause();
      } else if (char === '\u0003') {
        process.exit();
      } else {
        process.stdout.write('*');
      }
    });

    rl.question('Enter PostgreSQL admin (postgres user) password: ', (password) => {
      rl.close();
      console.log(''); // New line after password input
      resolve(password);
    });

    rl._writeToOutput = function _writeToOutput() {
      // Override to hide password input
    };
  });
}

async function setupTestDatabase() {
  const adminUser = process.env.POSTGRES_ADMIN_USER || 'postgres';
  let adminPassword = process.env.POSTGRES_ADMIN_PASSWORD;

  // Check if admin password is set
  if (!adminPassword || adminPassword === '') {
    console.log('\nPOSTGRES_ADMIN_PASSWORD not found in environment variables.');
    console.log('To avoid this prompt in the future, create a .env.test.local file:');
    console.log('  cp .env.test.local.example .env.test.local');
    console.log('  # Then edit .env.test.local and add your password\n');

    adminPassword = await promptForPassword();

    if (!adminPassword || adminPassword === '') {
      console.error('Error: Password is required to create test database.');
      console.error('Alternatively, configure PostgreSQL for trusted local authentication (pg_hba.conf)');
      process.exit(1);
    }
  }

  // First, connect to the default postgres database to create test database and user
  const adminClient = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: 'postgres', // Connect to default database
    user: adminUser,
    password: adminPassword,
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
      user: adminUser,
      password: adminPassword,
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
    console.error('Error setting up test database:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Verify the password is correct for the postgres user');
    console.error('3. Create a .env.test.local file with POSTGRES_ADMIN_PASSWORD');
    console.error('   (see .env.test.local.example for template)');
    console.error('\nIf you forgot your postgres password:');
    console.error('- Windows: May need to reinstall or use pg_admin to reset');
    console.error('- macOS/Linux: sudo -u postgres psql -c "ALTER USER postgres PASSWORD \'newpassword\';"');
    process.exit(1);
  }
}

setupTestDatabase();
