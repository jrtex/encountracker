#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Verifying test database isolation...\n');

// 1. Check .env.test exists
const envTestPath = path.resolve(__dirname, '..', '.env.test');
if (!fs.existsSync(envTestPath)) {
  console.error('❌ FAIL: .env.test file not found');
  process.exit(1);
}
console.log('✅ .env.test file exists');

// 2. Check .env.test contains DB_PATH=:memory:
const envTestContent = fs.readFileSync(envTestPath, 'utf8');
if (!envTestContent.includes('DB_PATH=:memory:')) {
  console.error('❌ FAIL: .env.test does not set DB_PATH=:memory:');
  process.exit(1);
}
console.log('✅ .env.test sets DB_PATH=:memory:');

// 3. Check package.json has setupFiles
const packageJson = require('../package.json');
if (!packageJson.jest.setupFiles || !packageJson.jest.setupFiles.includes('<rootDir>/tests/setup.js')) {
  console.error('❌ FAIL: Jest not configured to use setupFiles');
  process.exit(1);
}
console.log('✅ Jest configured with setupFiles');

// 4. Check production database state before tests
const dbPath = path.resolve(__dirname, '..', 'data', 'database.sqlite');
let dbStatBefore = null;
if (fs.existsSync(dbPath)) {
  dbStatBefore = fs.statSync(dbPath);
  console.log(`✅ Production database exists (size: ${dbStatBefore.size} bytes)`);
}

// 5. Run tests
console.log('\n📋 Running tests...');
try {
  execSync('npm test', { stdio: 'pipe', encoding: 'utf8' });
  console.log('✅ Tests passed');
} catch (error) {
  console.log('⚠️  Some tests failed (checking database isolation anyway)');
}

// 6. Check production database state after tests
if (dbStatBefore && fs.existsSync(dbPath)) {
  const dbStatAfter = fs.statSync(dbPath);
  if (dbStatBefore.size !== dbStatAfter.size ||
      dbStatBefore.mtimeMs !== dbStatAfter.mtimeMs) {
    console.error('\n❌ FAIL: Production database was modified during tests!');
    console.error(`   Before: ${dbStatBefore.size} bytes`);
    console.error(`   After:  ${dbStatAfter.size} bytes`);
    process.exit(1);
  }
  console.log('✅ Production database unchanged during tests');
}

// 7. Check for journal files
const journalPath = path.resolve(__dirname, '..', 'data', 'database.sqlite-journal');
if (fs.existsSync(journalPath)) {
  console.error('\n❌ FAIL: SQLite journal file exists');
  process.exit(1);
}
console.log('✅ No SQLite journal files found');

console.log('\n✅ All verification checks passed!');
