require('dotenv').config();
const database = require('./database');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

async function resetAdminPassword() {
  try {
    logger.info('Resetting admin password...');

    // Connect to database
    await database.connect();

    // Check if admin user exists
    const admin = await database.get(
      'SELECT id, username FROM users WHERE role = ?',
      ['admin']
    );

    if (!admin) {
      logger.error('No admin user found in database');
      logger.info('Run "npm run init-db" to create the default admin user');
      return;
    }

    // Reset password to default
    const defaultPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await database.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, admin.id]
    );

    logger.info('Admin password reset successfully');
    logger.info(`Username: ${admin.username}`);
    logger.info(`Password: ${defaultPassword}`);
    logger.info('IMPORTANT: Change this password after logging in!');

  } catch (error) {
    logger.error('Password reset failed:', error);
    throw error;
  } finally {
    await database.close();
  }
}

// Run if called directly
if (require.main === module) {
  resetAdminPassword()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = resetAdminPassword;
