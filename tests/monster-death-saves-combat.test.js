const request = require('supertest');
const express = require('express');
const combatRoutes = require('../server/routes/combat');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/combat', combatRoutes);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Monster Death Saves in Combat', () => {
  let adminToken, adminUserId, campaignId, encounterId;

  beforeAll(async () => {
    await database.connect();

    // Drop existing tables to ensure clean schema
    await database.exec(`
      DROP TABLE IF EXISTS initiative_tracker CASCADE;
      DROP TABLE IF EXISTS monster_actions CASCADE;
      DROP TABLE IF EXISTS monsters CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS encounters CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Initialize test database schema (PostgreSQL syntax)
    await database.exec(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'player',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE campaigns (
        id SERIAL PRIMARY KEY,
        dm_user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE encounters (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE TABLE players (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        user_id INTEGER,
        character_name VARCHAR(255) NOT NULL,
        character_class VARCHAR(255),
        level INTEGER DEFAULT 1,
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE monsters (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        dnd_api_id VARCHAR(255),
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        notes TEXT,
        allow_death_saves BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE initiative_tracker (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        participant_type VARCHAR(50) NOT NULL,
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT false,
        conditions TEXT DEFAULT '[]',
        temp_hp INTEGER DEFAULT 0,
        death_save_successes INTEGER DEFAULT 0,
        death_save_failures INTEGER DEFAULT 0,
        is_stabilized BOOLEAN DEFAULT false,
        is_removed_from_combat BOOLEAN DEFAULT false,
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
    const passwordHash = await bcrypt.hash('admin123', 10);
    const userResult = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@example.com', passwordHash, 'admin']
    );
    adminUserId = userResult.lastID;
    adminToken = generateToken({
      id: adminUserId,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    });

    // Create campaign
    const campaignResult = await database.run(
      'INSERT INTO campaigns (dm_user_id, name) VALUES (?, ?)',
      [adminUserId, 'Test Campaign']
    );
    campaignId = campaignResult.lastID;

    // Create encounter
    const encounterResult = await database.run(
      'INSERT INTO encounters (campaign_id, name, status) VALUES (?, ?, ?)',
      [campaignId, 'Test Encounter', 'active']
    );
    encounterId = encounterResult.lastID;
  });

  describe('Monster without death saves (allow_death_saves = false)', () => {
    test('should die immediately and be removed from combat when reaching 0 HP', async () => {
      // Create monster without death saves
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Goblin', 10, 10, 15, false]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 12, 1]
      );
      const initId = initResult.lastID;

      // Reduce HP to 0
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check monster HP
      const monster = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);
      expect(monster.current_hp).toBe(0);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.is_removed_from_combat).toBe(true);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c === 'Dead' || c.name === 'Dead')).toBe(true);
      expect(conditions.some(c => c === 'unconscious' || c.name === 'unconscious')).toBe(false);
    });

    test('should not allow death saves for monster without allow_death_saves', async () => {
      // Create monster without death saves
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Orc', 15, 0, 13, false]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 10, 1]
      );
      const initId = initResult.lastID;

      // Try to set death saves
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ death_save_failures: 1 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Death saves only apply to players and monsters with death saves enabled');
    });
  });

  describe('Monster with death saves (allow_death_saves = true)', () => {
    test('should become unconscious and initialize death saves when reaching 0 HP', async () => {
      // Create monster with death saves enabled
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Boss Villain', 100, 100, 18, true]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 15, 1]
      );
      const initId = initResult.lastID;

      // Reduce HP to 0
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check monster HP
      const monster = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);
      expect(monster.current_hp).toBe(0);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.is_removed_from_combat).toBe(false);
      expect(initEntry.death_save_successes).toBe(0);
      expect(initEntry.death_save_failures).toBe(0);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c === 'unconscious' || c.name === 'unconscious')).toBe(true);
      expect(conditions.some(c => c === 'Dead' || c.name === 'Dead')).toBe(false);
    });

    test('should die and be removed from combat after 3 death save failures', async () => {
      // Create monster with death saves enabled at 0 HP
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Dragon', 200, 0, 20, true]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, conditions) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 18, 1, JSON.stringify(['unconscious'])]
      );
      const initId = initResult.lastID;

      // Roll 3 death save failures
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ death_save_failures: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.is_removed_from_combat).toBe(true);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c.name === 'Dead')).toBe(true);
    });

    test('should stabilize after 3 death save successes', async () => {
      // Create monster with death saves enabled at 0 HP
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Lich', 135, 0, 17, true]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, conditions) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 16, 1, JSON.stringify(['unconscious'])]
      );
      const initId = initResult.lastID;

      // Roll 3 death save successes
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ death_save_successes: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check monster HP (should be 1)
      const monster = await database.get('SELECT * FROM monsters WHERE id = ?', [monsterId]);
      expect(monster.current_hp).toBe(1);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.is_stabilized).toBe(true);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c.name === 'Stabilized')).toBe(true);
      expect(conditions.some(c => c === 'unconscious' || c.name === 'unconscious')).toBe(false);
    });

    test('should reset death saves when stabilized monster takes damage', async () => {
      // Create monster with death saves enabled at 1 HP (stabilized)
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Vampire', 82, 1, 15, true]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker as stabilized
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, conditions, death_save_successes, is_stabilized) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 14, 1, JSON.stringify([{ type: 'custom', name: 'Stabilized', description: 'Stabilized' }]), 3, true]
      );
      const initId = initResult.lastID;

      // Deal damage
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.death_save_successes).toBe(0);
      expect(initEntry.death_save_failures).toBe(0);
      expect(initEntry.is_stabilized).toBe(false);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c.name === 'Stabilized')).toBe(false);
      expect(conditions.some(c => c === 'unconscious' || c.name === 'unconscious')).toBe(true);
    });

    test('should reset death saves when healing above 0 HP', async () => {
      // Create monster with death saves enabled at 0 HP
      const monsterResult = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, allow_death_saves) VALUES (?, ?, ?, ?, ?, ?)',
        [encounterId, 'Troll', 84, 0, 15, true]
      );
      const monsterId = monsterResult.lastID;

      // Add to initiative tracker with some death saves
      const initResult = await database.run(
        'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, conditions, death_save_failures) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [encounterId, 'monster', monsterId, 11, 1, JSON.stringify(['unconscious']), 2]
      );
      const initId = initResult.lastID;

      // Heal to above 0 HP
      const response = await request(app)
        .put(`/api/combat/initiative/${initId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check initiative tracker
      const initEntry = await database.get('SELECT * FROM initiative_tracker WHERE id = ?', [initId]);
      expect(initEntry.death_save_successes).toBe(0);
      expect(initEntry.death_save_failures).toBe(0);
      expect(initEntry.is_stabilized).toBe(false);

      const conditions = JSON.parse(initEntry.conditions);
      expect(conditions.some(c => c === 'unconscious' || c.name === 'unconscious')).toBe(false);
      expect(conditions.some(c => c === 'Dead' || c.name === 'Dead')).toBe(false);
    });
  });
});
