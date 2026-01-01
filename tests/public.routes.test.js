const request = require('supertest');
const express = require('express');
const publicRoutes = require('../server/routes/public');
const database = require('../server/utils/database');
const { errorHandler } = require('../server/middleware/errorHandler');

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);
app.use(errorHandler);

describe('Public Routes', () => {
  let campaignId;
  let encounterId;
  let playerId;
  let monsterId;

  beforeAll(async () => {
    await database.connect();

    // Create necessary tables
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        dm_user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS encounters (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        difficulty VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        current_round INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        character_name VARCHAR(100) NOT NULL,
        player_name VARCHAR(100),
        class VARCHAR(50),
        level INTEGER DEFAULT 1,
        max_hp INTEGER DEFAULT 10,
        current_hp INTEGER DEFAULT 10,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS monsters (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        max_hp INTEGER DEFAULT 10,
        current_hp INTEGER DEFAULT 10,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        speed INTEGER DEFAULT 30,
        allow_death_saves BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS initiative_tracker (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        participant_type VARCHAR(20) NOT NULL,
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT false,
        conditions TEXT DEFAULT '[]',
        temp_hp INTEGER DEFAULT 0,
        is_removed_from_combat BOOLEAN DEFAULT false,
        death_save_successes INTEGER DEFAULT 0,
        death_save_failures INTEGER DEFAULT 0,
        is_stabilized BOOLEAN DEFAULT false,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clean up data
    await database.run('DELETE FROM initiative_tracker');
    await database.run('DELETE FROM monsters');
    await database.run('DELETE FROM players');
    await database.run('DELETE FROM encounters');
    await database.run('DELETE FROM campaigns');
    await database.run('DELETE FROM users');

    // Create test data
    const userResult = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['testdm', 'testdm@example.com', 'hash123', 'admin']
    );

    const campaignResult = await database.run(
      'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
      ['Test Campaign', 'Test Description', userResult.lastID]
    );
    campaignId = campaignResult.lastID;

    const encounterResult = await database.run(
      'INSERT INTO encounters (campaign_id, name, description, difficulty, status, current_round) VALUES (?, ?, ?, ?, ?, ?)',
      [campaignId, 'Test Encounter', 'Test Description', 'medium', 'active', 3]
    );
    encounterId = encounterResult.lastID;

    const playerResult = await database.run(
      'INSERT INTO players (campaign_id, character_name, player_name, class, level, max_hp, current_hp, armor_class, initiative_bonus, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [campaignId, 'Test Player', 'John', 'Fighter', 5, 50, 30, 18, 2, true]
    );
    playerId = playerResult.lastID;

    const monsterResult = await database.run(
      'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class, initiative_bonus, speed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [encounterId, 'Test Monster', 100, 60, 15, 1, 30]
    );
    monsterId = monsterResult.lastID;

    // Add to initiative tracker
    await database.run(
      'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, is_current_turn, conditions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [encounterId, 'player', playerId, 18, 1, true, '["blinded"]']
    );

    await database.run(
      'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, is_current_turn, conditions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [encounterId, 'monster', monsterId, 12, 2, false, '[]']
    );
  });

  describe('GET /api/public/active-encounter', () => {
    test('should return active encounter with filtered monster data', async () => {
      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.encounter).toBeDefined();
      expect(res.body.data.encounter.name).toBe('Test Encounter');
      expect(res.body.data.encounter.current_round).toBe(3);
      expect(res.body.data.participants).toHaveLength(2);

      // Check player data (should have all info)
      const player = res.body.data.participants.find(p => p.participant_type === 'player');
      expect(player).toBeDefined();
      expect(player.name).toBe('Test Player');
      expect(player.current_hp).toBe(30);
      expect(player.max_hp).toBe(50);
      expect(player.armor_class).toBe(18);
      expect(player.hp_percentage).toBe(60);
      expect(player.conditions).toEqual(['blinded']);

      // Check monster data (should NOT have secret info)
      const monster = res.body.data.participants.find(p => p.participant_type === 'monster');
      expect(monster).toBeDefined();
      expect(monster.name).toBe('Test Monster');
      expect(monster.hp_percentage).toBe(60);
      expect(monster.current_hp).toBeUndefined(); // Secret
      expect(monster.max_hp).toBeUndefined(); // Secret
      expect(monster.armor_class).toBeUndefined(); // Secret
    });

    test('should return null when no active encounter exists', async () => {
      // Set encounter to pending
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['pending', encounterId]);

      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
      expect(res.body.message).toBe('No active encounter found');
    });

    test('should calculate hp_percentage correctly', async () => {
      // Update player to 25 HP (50% of 50)
      await database.run('UPDATE players SET current_hp = ? WHERE id = ?', [25, playerId]);

      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      const player = res.body.data.participants.find(p => p.participant_type === 'player');
      expect(player.hp_percentage).toBe(50);
    });

    test('should handle participants with temp_hp', async () => {
      // Add temp HP to initiative tracker
      await database.run('UPDATE initiative_tracker SET temp_hp = ? WHERE participant_type = ? AND participant_id = ?',
        [10, 'player', playerId]);

      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      const player = res.body.data.participants.find(p => p.participant_type === 'player');
      expect(player.temp_hp).toBe(10);
    });

    test('should handle removed participants', async () => {
      // Mark monster as removed
      await database.run('UPDATE initiative_tracker SET is_removed_from_combat = ? WHERE participant_type = ? AND participant_id = ?',
        [true, 'monster', monsterId]);

      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      const monster = res.body.data.participants.find(p => p.participant_type === 'monster');
      expect(monster.is_removed_from_combat).toBe(true);
    });

    test('should include encounter metadata', async () => {
      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      expect(res.body.data.encounter).toMatchObject({
        id: encounterId,
        name: 'Test Encounter',
        description: 'Test Description',
        difficulty: 'medium',
        campaign_name: 'Test Campaign',
        current_round: 3
      });
    });

    test('should handle multiple active encounters (returns most recent)', async () => {
      // Create another active encounter
      const encounter2 = await database.run(
        'INSERT INTO encounters (campaign_id, name, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [campaignId, 'Newer Encounter', 'active']
      );

      const res = await request(app).get('/api/public/active-encounter');

      expect(res.status).toBe(200);
      // Should return the most recently updated encounter
      expect(res.body.data.encounter.name).toBe('Newer Encounter');
    });
  });
});
