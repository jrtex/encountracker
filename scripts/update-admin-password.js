#!/usr/bin/env node

/**
 * Update Admin Password Utility
 *
 * This script updates the admin user's password.
 * Works in both Docker and local development environments.
 *
 * Usage:
 *   npm run update-admin-password
 *   node scripts/update-admin-password.js
 */

// Load environment variables
require('dotenv').config();

const bcrypt = require('bcryptjs');
const readline = require('readline');
const database = require('../server/utils/database');

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Recreate readline interface (needed after raw mode)
 */
function recreateReadline() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Prompt for password (hidden input)
 */
function promptPassword(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let password = '';

    const onData = (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          stdin.setRawMode(false);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // backspace
          password = password.slice(0, -1);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(question);
          break;
        default:
          password += char;
          break;
      }
    };

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/**
 * Check password strength and return warnings
 */
function checkPasswordStrength(password) {
  const warnings = [];

  if (password.length < 8) {
    warnings.push('Password is less than 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    warnings.push('Password does not contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    warnings.push('Password does not contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    warnings.push('Password does not contain a number');
  }

  return warnings;
}

/**
 * Update admin password
 */
async function updateAdminPassword() {
  try {
    console.log('=== Update Admin Password ===\n');

    // Connect to database
    console.log('Connecting to database...');
    await database.connect();

    // Check if admin user exists
    const adminUser = await database.get(
      'SELECT id, username FROM users WHERE username = $1',
      ['admin']
    );

    if (!adminUser) {
      console.error('Error: Admin user not found in database.');
      console.log('Please run "npm run init-db" to create the admin user first.');
      process.exit(1);
    }

    console.log(`Found admin user (ID: ${adminUser.id})\n`);

    // Get new password
    let newPassword, confirmPassword;
    let passwordConfirmed = false;

    while (!passwordConfirmed) {
      newPassword = await promptPassword('Enter new password: ');

      if (newPassword === 'admin123') {
        console.log('\n⚠️  Error: You cannot use the default password "admin123"');
        console.log('Please choose a different password.\n');
        continue;
      }

      // Check password strength and show warnings
      const warnings = checkPasswordStrength(newPassword);
      if (warnings.length > 0) {
        console.log('\n⚠️  Password strength warnings:');
        warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('   (Recommended: 8+ characters with uppercase, lowercase, and numbers)');

        // Recreate readline interface after password prompt used raw mode
        recreateReadline();

        const continueAnyway = await prompt('\nContinue with this password anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
          console.log('Please try again.\n');
          continue;
        }
      }

      confirmPassword = await promptPassword('\nConfirm new password: ');

      if (newPassword !== confirmPassword) {
        console.log('\n⚠️  Passwords do not match. Please try again.\n');
        continue;
      }

      passwordConfirmed = true;
    }

    // Hash password
    console.log('\nHashing password...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    console.log('Updating password in database...');
    await database.run(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, adminUser.id]
    );

    console.log('\n✅ Admin password updated successfully!\n');

    rl.close();
    await database.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error updating password:', error.message);
    rl.close();
    await database.close();
    process.exit(1);
  }
}

// Run the script
updateAdminPassword();
