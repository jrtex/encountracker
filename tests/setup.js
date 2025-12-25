// Jest setup file - Runs BEFORE all tests and module imports
const path = require('path');
const fs = require('fs');

// Load .env.test file (must exist for tests)
const envTestPath = path.resolve(__dirname, '..', '.env.test');
if (!fs.existsSync(envTestPath)) {
  throw new Error(
    `.env.test file not found at ${envTestPath}. ` +
    'This file is required for test database isolation. ' +
    'Please create it with PostgreSQL test database credentials.'
  );
}

const result = require('dotenv').config({ path: '.env.test' });
if (result.error) {
  throw new Error(`Failed to load .env.test: ${result.error.message}`);
}

// Verify critical test environment variables are set
if (!process.env.POSTGRES_DB || !process.env.POSTGRES_DB.includes('test')) {
  throw new Error(
    `CRITICAL: POSTGRES_DB must include "test" in the name. ` +
    `Current value: "${process.env.POSTGRES_DB}". ` +
    `This prevents tests from polluting production/dev databases.`
  );
}

if (process.env.NODE_ENV !== 'test') {
  console.warn(
    `WARNING: NODE_ENV is "${process.env.NODE_ENV}", expected "test". ` +
    `This may cause unexpected behavior.`
  );
}

// Explicitly set critical test environment variables (defense-in-depth)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Mock logger to suppress logs during tests
jest.mock('../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
