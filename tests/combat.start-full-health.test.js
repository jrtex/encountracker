const request = require('supertest');
const express = require('express');
const combatRouter = require('../server/routes/combat');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/combat', combatRouter);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Start Combat with Full Health Feature', () => {
  let adminToken;
  let adminUserId;
  let campaignId;
  let encounterId;
  let playerId;
  let monsterId;

  beforeAll(async () => {
    await database.connect();

    // Initialize test database schema
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'player',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        dm_user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS encounters (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed')),
        current_round INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        character_name VARCHAR(255) NOT NULL,
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER NOT NULL DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS monsters (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        dnd_api_id VARCHAR(255),
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER NOT NULL,
        initiative_bonus INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS initiative_tracker (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        participant_type VARCHAR(50) NOT NULL CHECK(participant_type IN ('player', 'monster')),
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT false,
        conditions TEXT,
        temp_hp INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clear tables before each test
    await database.run('DELETE FROM initiative_tracker');
    await database.run('DELETE FROM monsters');
    await database.run('DELETE FROM players');
    await database.run('DELETE FROM encounters');
    await database.run('DELETE FROM campaigns');
    await database.run('DELETE FROM users');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const adminResult = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@example.com', adminPasswordHash, 'admin']
    );
    adminUserId = adminResult.lastID;
    adminToken = generateToken({
      id: adminUserId,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    });

    // Create campaign
    const campaignResult = await database.run(
      `INSERT INTO campaigns (name, dm_user_id)
       VALUES (?, ?)`,
      ['Test Campaign', adminUserId]
    );
    campaignId = campaignResult.lastID;

    // Create encounter
    const encounterResult = await database.run(
      `INSERT INTO encounters (campaign_id, name, status)
       VALUES (?, ?, ?)`,
      [campaignId, 'Test Encounter', 'pending']
    );
    encounterId = encounterResult.lastID;

    // Create player with reduced HP (max 30, current 15)
    const playerResult = await database.run(
      `INSERT INTO players (campaign_id, character_name, max_hp, current_hp, armor_class, initiative_bonus, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [campaignId, 'Test Player', 30, 15, 15, 2, 1]
    );
    playerId = playerResult.lastID;

    // Create monster with reduced HP (max 50, current 25)
    const monsterResult = await database.run(
      `INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, initiative_bonus)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [encounterId, 'Test Monster', 50, 25, 13, 1]
    );
    monsterId = monsterResult.lastID;
  });

  afterAll(async () => {
    await database.close();
  });

  describe('POST /api/combat/:encounter_id/start with start_with_full_health=true', () => {
    test('should reset all participants to full health', async () => {
      // Verify initial HP values
      const playerBefore = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterBefore = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerBefore.current_hp).toBe(15);
      expect(playerBefore.max_hp).toBe(30);
      expect(monsterBefore.current_hp).toBe(25);
      expect(monsterBefore.max_hp).toBe(50);

      // Start combat with full health setting
      const response = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          initiative_mode: 'auto',
          start_with_full_health: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify HP was reset to full
      const playerAfter = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterAfter = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerAfter.current_hp).toBe(30); // Should be reset to max_hp
      expect(monsterAfter.current_hp).toBe(50); // Should be reset to max_hp
    });
  });

  describe('POST /api/combat/:encounter_id/start with start_with_full_health=false', () => {
    test('should keep current HP values', async () => {
      // Verify initial HP values
      const playerBefore = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterBefore = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerBefore.current_hp).toBe(15);
      expect(monsterBefore.current_hp).toBe(25);

      // Start combat WITHOUT resetting health
      const response = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          initiative_mode: 'auto',
          start_with_full_health: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify HP was NOT changed
      const playerAfter = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterAfter = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerAfter.current_hp).toBe(15); // Should remain unchanged
      expect(monsterAfter.current_hp).toBe(25); // Should remain unchanged
    });
  });

  describe('POST /api/combat/:encounter_id/start with start_with_full_health omitted', () => {
    test('should default to true and reset HP', async () => {
      // Verify initial HP values
      const playerBefore = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterBefore = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerBefore.current_hp).toBe(15);
      expect(monsterBefore.current_hp).toBe(25);

      // Start combat without specifying the setting (should default to true)
      const response = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          initiative_mode: 'auto'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify HP was reset to full (default behavior)
      const playerAfter = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      const monsterAfter = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);

      expect(playerAfter.current_hp).toBe(30); // Should be reset to max_hp (default)
      expect(monsterAfter.current_hp).toBe(50); // Should be reset to max_hp (default)
    });
  });

  describe('POST /api/combat/:encounter_id/start with manual initiative', () => {
    test('should reset HP with manual initiative mode', async () => {
      // Verify initial HP values
      const playerBefore = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      expect(playerBefore.current_hp).toBe(15);

      // Start combat with manual initiative and full health
      const response = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          initiative_mode: 'manual',
          manual_initiatives: [
            {
              participant_type: 'player',
              participant_id: playerId,
              initiative: 18
            }
          ],
          start_with_full_health: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify HP was reset
      const playerAfter = await database.get('SELECT * FROM players WHERE id = ?', [playerId]);
      expect(playerAfter.current_hp).toBe(30);
    });
  });
});
