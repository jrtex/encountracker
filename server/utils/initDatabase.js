require('dotenv').config();
const database = require('./database');
const { createTablesSQL } = require('../models/schema');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

async function initializeDatabase(standalone = false) {
  try {
    logger.info('Initializing database...');

    // Connect to database only if running standalone
    if (standalone) {
      await database.connect();
    }

    // Create tables
    logger.info('Creating tables...');
    await database.exec(createTablesSQL);
    logger.info('Tables created successfully');

    // Check if admin user exists
    const adminExists = await database.get(
      'SELECT id FROM users WHERE role = ?',
      ['admin']
    );

    if (!adminExists) {
      logger.info('Creating default admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await database.run(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES (?, ?, ?, ?)`,
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );

      logger.info('Default admin user created');
      logger.info('Username: admin');
      logger.info('Password: admin123');
      logger.info('IMPORTANT: Change this password in production!');
    } else {
      logger.info('Admin user already exists');
    }

    logger.info('Database initialization complete');

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  } finally {
    // Only close database if running standalone
    if (standalone) {
      await database.close();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initializeDatabase;
