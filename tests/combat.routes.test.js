const request = require('supertest');
const express = require('express');
const combatRoutes = require('../server/routes/combat');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Setup express app for testing
const app = express();
app.use(express.json());
app.use('/api/combat', combatRoutes);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Combat Routes - Status Effects', () => {
  let adminToken, userToken, adminUserId, regularUserId;
  let campaignId, encounterId, playerId, monsterId, initiativeId;

  beforeAll(async () => {
    await database.connect();

    // Drop existing tables to ensure clean schema
    await database.exec(`
      DROP TABLE IF EXISTS initiative_tracker CASCADE;
      DROP TABLE IF EXISTS monsters CASCADE;
      DROP TABLE IF EXISTS players CASCADE;
      DROP TABLE IF EXISTS encounters CASCADE;
      DROP TABLE IF EXISTS campaigns CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create schema
    await database.exec(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'player',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE campaigns (
        id SERIAL PRIMARY KEY,
        dm_user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE encounters (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        difficulty VARCHAR(50) CHECK(difficulty IN ('easy', 'medium', 'hard', 'deadly')),
        status VARCHAR(50) CHECK(status IN ('pending', 'active', 'completed')) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        speed INTEGER DEFAULT 30,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        armor_class INTEGER NOT NULL,
        initiative_bonus INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE initiative_tracker (
        id SERIAL PRIMARY KEY,
        encounter_id INTEGER NOT NULL,
        participant_type VARCHAR(50) NOT NULL CHECK(participant_type IN ('player', 'monster')),
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT false,
        conditions TEXT,
        temp_hp INTEGER DEFAULT 0,
        is_removed_from_combat BOOLEAN DEFAULT false,
        death_save_successes INTEGER DEFAULT 0,
        death_save_failures INTEGER DEFAULT 0,
        is_stabilized BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clear all tables
    await database.run('DELETE FROM initiative_tracker');
    await database.run('DELETE FROM monsters');
    await database.run('DELETE FROM players');
    await database.run('DELETE FROM encounters');
    await database.run('DELETE FROM campaigns');
    await database.run('DELETE FROM users');

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminUser = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@test.com', passwordHash, 'admin']
    );
    adminUserId = adminUser.lastID;
    adminToken = generateToken({
      id: adminUserId,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin'
    });

    // Create regular user
    const regularUser = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['user', 'user@test.com', passwordHash, 'player']
    );
    regularUserId = regularUser.lastID;
    userToken = generateToken({
      id: regularUserId,
      username: 'user',
      email: 'user@test.com',
      role: 'player'
    });

    // Create campaign
    const campaign = await database.run(
      'INSERT INTO campaigns (dm_user_id, name) VALUES (?, ?)',
      [adminUserId, 'Test Campaign']
    );
    campaignId = campaign.lastID;

    // Create encounter
    const encounter = await database.run(
      'INSERT INTO encounters (campaign_id, name, status) VALUES (?, ?, ?)',
      [campaignId, 'Test Encounter', 'active']
    );
    encounterId = encounter.lastID;

    // Create player
    const player = await database.run(
      'INSERT INTO players (campaign_id, character_name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
      [campaignId, 'Test Hero', 30, 30, 15]
    );
    playerId = player.lastID;

    // Create monster
    const monster = await database.run(
      'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
      [encounterId, 'Test Goblin', 10, 10, 12]
    );
    monsterId = monster.lastID;

    // Create initiative tracker entry for player
    const initiative = await database.run(
      'INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order, conditions) VALUES (?, ?, ?, ?, ?, ?)',
      [encounterId, 'player', playerId, 15, 1, JSON.stringify([])]
    );
    initiativeId = initiative.lastID;
  });

  describe('PUT /api/combat/initiative/:id - Standard Conditions', () => {
    test('should add standard condition (string) to participant', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conditions).toContain('poisoned');
      expect(response.body.data.conditions).toHaveLength(1);
    });

    test('should add multiple standard conditions', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'stunned', 'frightened'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conditions).toContain('poisoned');
      expect(response.body.data.conditions).toContain('stunned');
      expect(response.body.data.conditions).toContain('frightened');
      expect(response.body.data.conditions).toHaveLength(3);
    });
  });

  describe('PUT /api/combat/initiative/:id - Custom Conditions', () => {
    test('should add custom condition (object) to participant', async () => {
      const customCondition = {
        name: 'Hex',
        description: "Can't move more than 30 feet",
        type: 'custom'
      };

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [customCondition] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.conditions).toHaveLength(1);
      expect(response.body.data.conditions[0]).toMatchObject(customCondition);
    });

    test('should add multiple custom conditions', async () => {
      const conditions = [
        { name: 'Hex', description: 'Test 1', type: 'custom' },
        { name: 'Hunter\'s Mark', description: 'Test 2', type: 'custom' }
      ];

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(2);
      expect(response.body.data.conditions[0].name).toBe('Hex');
      expect(response.body.data.conditions[1].name).toBe('Hunter\'s Mark');
    });
  });

  describe('PUT /api/combat/initiative/:id - Mixed Conditions', () => {
    test('should handle mixed standard and custom conditions', async () => {
      const conditions = [
        'poisoned',
        'stunned',
        { name: 'Hex', description: 'Test', type: 'custom' }
      ];

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(3);
      expect(response.body.data.conditions).toContain('poisoned');
      expect(response.body.data.conditions).toContain('stunned');
      expect(response.body.data.conditions.some(c => typeof c === 'object' && c.name === 'Hex')).toBe(true);
    });
  });

  describe('PUT /api/combat/initiative/:id - Validation', () => {
    test('should reject invalid custom condition (missing name)', async () => {
      const invalidCondition = { description: 'Test', type: 'custom' };

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [invalidCondition] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid custom condition (missing description)', async () => {
      const invalidCondition = { name: 'Hex', type: 'custom' };

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [invalidCondition] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid custom condition (missing type)', async () => {
      const invalidCondition = { name: 'Hex', description: 'Test' };

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [invalidCondition] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid condition (number)', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [123] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid condition (null)', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [null] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/combat/initiative/:id - Unconscious Auto-Management', () => {
    test('should auto-add unconscious when HP drops to 0', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toContain('unconscious');
    });

    test('should auto-add unconscious when HP drops below 0', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: -5 });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toContain('unconscious');
    });

    test('should auto-remove unconscious when HP rises above 0', async () => {
      // First set HP to 0
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      // Then heal
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).not.toContain('unconscious');
    });

    test('should not add duplicate unconscious condition', async () => {
      // Manually add unconscious
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['unconscious'] });

      // Drop HP to 0
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      expect(response.status).toBe(200);
      const unconsciousCount = response.body.data.conditions.filter(c =>
        (typeof c === 'string' && c === 'unconscious') ||
        (typeof c === 'object' && c.name === 'unconscious')
      ).length;
      expect(unconsciousCount).toBe(1);
    });

    test('should preserve custom conditions when HP auto-manages unconscious', async () => {
      const customCondition = { name: 'Hex', description: 'Test', type: 'custom' };

      // Add custom condition
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [customCondition] });

      // Drop HP to 0 (should add unconscious, keep custom)
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(2);
      expect(response.body.data.conditions).toContain('unconscious');
      expect(response.body.data.conditions.some(c => typeof c === 'object' && c.name === 'Hex')).toBe(true);
    });

    test('should preserve standard conditions when HP auto-manages unconscious', async () => {
      // Add standard conditions
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'stunned'] });

      // Drop HP to 0
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(3);
      expect(response.body.data.conditions).toContain('unconscious');
      expect(response.body.data.conditions).toContain('poisoned');
      expect(response.body.data.conditions).toContain('stunned');
    });
  });

  describe('PUT /api/combat/initiative/:id - Condition Removal', () => {
    test('should remove conditions when passed empty array', async () => {
      // Add conditions first
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'stunned'] });

      // Remove all
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [] });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(0);
    });

    test('should remove specific conditions', async () => {
      // Add conditions
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'stunned', 'frightened'] });

      // Remove one
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'frightened'] });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(2);
      expect(response.body.data.conditions).toContain('poisoned');
      expect(response.body.data.conditions).toContain('frightened');
      expect(response.body.data.conditions).not.toContain('stunned');
    });
  });

  describe('PUT /api/combat/initiative/:id - Authorization', () => {
    test('should require admin role to update conditions', async () => {
      // Create player token
      const playerToken = generateToken({
        id: 999,
        username: 'player',
        email: 'player@test.com',
        role: 'player'
      });

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ conditions: ['poisoned'] });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .send({ conditions: ['poisoned'] });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/combat/initiative/:id - Ownership', () => {
    test('should not allow updating conditions for other DM\'s encounters', async () => {
      // Create another admin user
      const otherAdminHash = await bcrypt.hash('admin456', 10);
      const otherAdmin = await database.run(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['other_admin', 'other@test.com', otherAdminHash, 'admin']
      );

      const otherAdminToken = generateToken({
        id: otherAdmin.lastID,
        username: 'other_admin',
        email: 'other@test.com',
        role: 'admin'
      });

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${otherAdminToken}`)
        .send({ conditions: ['poisoned'] });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Initiative entry not found or access denied');
    });
  });

  describe('PUT /api/combat/initiative/:id - Edge Cases', () => {
    test('should handle empty conditions array', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: [] });

      expect(response.status).toBe(200);
      expect(response.body.data.conditions).toHaveLength(0);
    });

    test('should handle updating other fields without affecting conditions', async () => {
      // Add conditions
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned'] });

      // Update initiative value only
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data.initiative).toBe(20);
      expect(response.body.data.conditions).toContain('poisoned');
    });
  });

  describe('PUT /api/combat/initiative/:id/temp-hp - Temporary HP', () => {
    test('should add temporary HP to participant', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.temp_hp).toBe(10);
    });

    test('should add to existing temporary HP', async () => {
      // Add initial temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 5 });

      // Add more temp HP
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 8 });

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(13); // 5 + 8
    });

    test('should reject negative temporary HP', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: -5 });

      expect(response.status).toBe(400);
    });

    test('should require admin role to add temp HP', async () => {
      // Create player user
      const playerPasswordHash = await bcrypt.hash('player123', 10);
      const playerUser = await database.run(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['player', 'player@test.com', playerPasswordHash, 'player']
      );
      const playerToken = generateToken({
        id: playerUser.lastID,
        username: 'player',
        email: 'player@test.com',
        role: 'player'
      });

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ temp_hp: 10 });

      expect(response.status).toBe(403);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .send({ temp_hp: 10 });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/combat/initiative/:id - Damage with Temporary HP', () => {
    test('should apply damage to temp HP first', async () => {
      // Add temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 10 });

      // Get current HP
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      const initialHp = player.current_hp;

      // Apply 5 damage (less than temp HP)
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: initialHp - 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(5); // 10 - 5
      expect(response.body.data.current_hp).toBe(initialHp); // HP unchanged
    });

    test('should apply damage to temp HP then overflow to regular HP', async () => {
      // Add temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 10 });

      // Get current HP
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      const initialHp = player.current_hp;

      // Apply 15 damage (more than temp HP)
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: initialHp - 15 });

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(0); // All temp HP consumed
      expect(response.body.data.current_hp).toBe(initialHp - 5); // 15 - 10 temp HP = 5 damage to regular HP
    });

    test('should remove all temp HP when damage exceeds it', async () => {
      // Add temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 3 });

      // Get current HP
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      const initialHp = player.current_hp;

      // Apply 20 damage
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: initialHp - 20 });

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(0);
      expect(response.body.data.current_hp).toBe(initialHp - 17); // 20 - 3 temp HP
    });

    test('should not affect temp HP when healing', async () => {
      // Damage player first
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      const initialHp = player.current_hp;

      await database.run('UPDATE players SET current_hp = ? WHERE id = ?', [initialHp - 10, playerId]);

      // Add temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 5 });

      // Heal
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: initialHp - 5 }); // Heal 5 HP

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(5); // Temp HP unchanged
      expect(response.body.data.current_hp).toBe(initialHp - 5);
    });

    test('should auto-add unconscious when temp HP is present but regular HP drops to 0', async () => {
      // Add temp HP
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}/temp-hp`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ temp_hp: 10 });

      // Get current HP
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      const initialHp = player.current_hp;

      // Apply damage equal to (temp HP + regular HP)
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: initialHp - (10 + initialHp) });

      expect(response.status).toBe(200);
      expect(response.body.data.temp_hp).toBe(0);
      expect(response.body.data.current_hp).toBe(0);
      expect(response.body.data.conditions).toContain('unconscious');
    });
  });

  describe('Remove from Combat', () => {
    test('should mark player as removed from combat', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_removed_from_combat).toBe(true);
    });

    test('should re-add removed player to combat', async () => {
      // First remove
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      // Then re-add
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_removed_from_combat).toBe(false);
    });

    test('should skip removed players on next turn', async () => {
      // End existing combat first to clear old initiative entries
      await database.run('DELETE FROM initiative_tracker WHERE encounter_id = ?', [encounterId]);
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['pending', encounterId]);

      // Start combat to set up initiative tracker
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'manual',
          initiatives: [
            { participant_type: 'player', participant_id: playerId, initiative: 20 },
            { participant_type: 'monster', participant_id: monsterId, initiative: 15 }
          ]
        });

      // Get initiative entries
      const initiatives = await database.all(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? ORDER BY turn_order ASC',
        [encounterId]
      );

      expect(initiatives.length).toBe(2);
      const playerInitId = initiatives.find(i => i.participant_type === 'player').id;
      const monsterInitId = initiatives.find(i => i.participant_type === 'monster').id;

      // Remove the second participant (monster)
      await request(app)
        .put(`/api/combat/initiative/${monsterInitId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      // Advance turn (should skip removed monster and wrap around to player)
      const response = await request(app)
        .post(`/api/combat/${encounterId}/next-turn`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify player is current turn (skipped the removed monster)
      const currentInit = await database.get(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? AND is_current_turn = true',
        [encounterId]
      );
      expect(currentInit.id).toBe(playerInitId);
    });

    test('should advance turn if removing current active participant', async () => {
      // Clear existing initiative entries
      await database.run('DELETE FROM initiative_tracker WHERE encounter_id = ?', [encounterId]);
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['pending', encounterId]);

      // Start combat
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'manual',
          initiatives: [
            { participant_type: 'player', participant_id: playerId, initiative: 20 },
            { participant_type: 'monster', participant_id: monsterId, initiative: 15 }
          ]
        });

      // Get current turn participant
      const currentInit = await database.get(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? AND is_current_turn = true',
        [encounterId]
      );

      expect(currentInit).toBeDefined();

      // Remove current active participant
      const response = await request(app)
        .put(`/api/combat/initiative/${currentInit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      expect(response.status).toBe(200);

      // Verify turn advanced to next participant
      const newCurrentInit = await database.get(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? AND is_current_turn = true',
        [encounterId]
      );
      expect(newCurrentInit).toBeDefined();
      expect(newCurrentInit.id).not.toBe(currentInit.id);
    });

    test('should clear removal status when combat starts', async () => {
      // Clear existing initiative entries
      await database.run('DELETE FROM initiative_tracker WHERE encounter_id = ?', [encounterId]);
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['pending', encounterId]);

      // Start combat
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'manual',
          initiatives: [
            { participant_type: 'player', participant_id: playerId, initiative: 20 }
          ]
        });

      // Get initiative entry
      const init = await database.get(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ?',
        [encounterId]
      );

      expect(init).toBeDefined();

      // Remove player
      await request(app)
        .put(`/api/combat/initiative/${init.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      // End combat
      await request(app)
        .post(`/api/combat/${encounterId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ mark_complete: false });

      // Start new combat
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'manual',
          initiatives: [
            { participant_type: 'player', participant_id: playerId, initiative: 20 }
          ]
        });

      // Verify removal status is cleared
      const newInit = await database.get(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ?',
        [encounterId]
      );
      expect(newInit).toBeDefined();
      expect(newInit.is_removed_from_combat).toBe(false);
    });

    test('should handle all participants removed gracefully', async () => {
      // Clear existing initiative entries
      await database.run('DELETE FROM initiative_tracker WHERE encounter_id = ?', [encounterId]);
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['pending', encounterId]);

      // Start combat with 2 participants
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mode: 'manual',
          initiatives: [
            { participant_type: 'player', participant_id: playerId, initiative: 20 },
            { participant_type: 'monster', participant_id: monsterId, initiative: 15 }
          ]
        });

      // Get all initiative entries
      const initiatives = await database.all(
        'SELECT * FROM initiative_tracker WHERE encounter_id = ? ORDER BY turn_order ASC',
        [encounterId]
      );

      expect(initiatives.length).toBe(2);

      // Remove all participants except current
      for (const init of initiatives) {
        if (!init.is_current_turn) {
          await request(app)
            .put(`/api/combat/initiative/${init.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ is_removed_from_combat: true });
        }
      }

      // Next turn should still work (wraps to first participant even if removed)
      const response = await request(app)
        .post(`/api/combat/${encounterId}/next-turn`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should clear all conditions when removing from combat', async () => {
      // First add some conditions
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conditions: ['poisoned', 'blinded'] });

      // Verify conditions were added
      let initiative = await database.get(
        'SELECT conditions FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      let conditions = JSON.parse(initiative.conditions);
      expect(conditions).toEqual(['poisoned', 'blinded']);

      // Remove from combat
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      expect(response.status).toBe(200);

      // Verify conditions were cleared
      initiative = await database.get(
        'SELECT conditions FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      conditions = JSON.parse(initiative.conditions);
      expect(conditions).toEqual([]);
    });

    test('should set HP to 1 when re-adding player with 0 HP', async () => {
      // Set player HP to 0
      await database.run(
        'UPDATE players SET current_hp = 0 WHERE id = ?',
        [playerId]
      );

      // Remove from combat
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      // Re-add to combat
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: false });

      expect(response.status).toBe(200);

      // Verify HP was bumped to 1
      const player = await database.get(
        'SELECT current_hp FROM players WHERE id = ?',
        [playerId]
      );
      expect(player.current_hp).toBe(1);
    });

    test('should not modify HP when re-adding player with HP > 0', async () => {
      // Ensure player has HP > 0
      await database.run(
        'UPDATE players SET current_hp = 15 WHERE id = ?',
        [playerId]
      );

      // Remove from combat
      await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: true });

      // Re-add to combat
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_removed_from_combat: false });

      expect(response.status).toBe(200);

      // Verify HP was not modified
      const player = await database.get(
        'SELECT current_hp FROM players WHERE id = ?',
        [playerId]
      );
      expect(player.current_hp).toBe(15);
    });
  });

  describe('PUT /api/combat/initiative/:id/death-saves - Death Saves', () => {
    let initiativeId;

    beforeEach(async () => {
      // Set player HP to 0 to enable death saves
      await database.run(
        'UPDATE players SET current_hp = 0 WHERE id = ?',
        [playerId]
      );

      // Get initiative ID
      const initiative = await database.get(
        'SELECT id FROM initiative_tracker WHERE encounter_id = ? AND participant_type = ? AND participant_id = ?',
        [encounterId, 'player', playerId]
      );
      initiativeId = initiative.id;

      // Initialize death saves
      await database.run(
        'UPDATE initiative_tracker SET death_save_successes = 0, death_save_failures = 0, is_stabilized = false WHERE id = ?',
        [initiativeId]
      );
    });

    test('should initialize death saves when HP reaches 0', async () => {
      // Set HP to 5 first
      await database.run('UPDATE players SET current_hp = 5 WHERE id = ?', [playerId]);

      // Set some death saves (should be reset)
      await database.run(
        'UPDATE initiative_tracker SET death_save_successes = 2, death_save_failures = 1 WHERE id = ?',
        [initiativeId]
      );

      // Update HP to 0
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 0 });

      expect(response.status).toBe(200);

      // Verify death saves were reset
      const entry = await database.get(
        'SELECT death_save_successes, death_save_failures, is_stabilized FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.death_save_successes).toBe(0);
      expect(entry.death_save_failures).toBe(0);
      expect(entry.is_stabilized).toBe(false);
    });

    test('should reset death saves when HP rises above 0', async () => {
      // Set some death saves
      await database.run(
        'UPDATE initiative_tracker SET death_save_successes = 2, death_save_failures = 1 WHERE id = ?',
        [initiativeId]
      );

      // Heal player
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ current_hp: 5 });

      expect(response.status).toBe(200);

      // Verify death saves were reset
      const entry = await database.get(
        'SELECT death_save_successes, death_save_failures, is_stabilized FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.death_save_successes).toBe(0);
      expect(entry.death_save_failures).toBe(0);
      expect(entry.is_stabilized).toBe(false);
    });

    test('should increment death save successes', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 1,
          death_save_failures: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const entry = await database.get(
        'SELECT death_save_successes, death_save_failures FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.death_save_successes).toBe(1);
      expect(entry.death_save_failures).toBe(0);
    });

    test('should increment death save failures', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 0,
          death_save_failures: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const entry = await database.get(
        'SELECT death_save_successes, death_save_failures FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.death_save_successes).toBe(0);
      expect(entry.death_save_failures).toBe(1);
    });

    test('should stabilize player with 3 successes', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 3,
          death_save_failures: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify stabilization
      const entry = await database.get(
        'SELECT is_stabilized, conditions FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.is_stabilized).toBe(true);

      const conditions = JSON.parse(entry.conditions);
      expect(conditions).toContainEqual('stabilized');
      expect(conditions).not.toContainEqual('unconscious');

      // Verify HP was set to 1
      const player = await database.get('SELECT current_hp FROM players WHERE id = ?', [playerId]);
      expect(player.current_hp).toBe(1);
    });

    test('should kill player with 3 failures', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 0,
          death_save_failures: 3
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify death
      const entry = await database.get(
        'SELECT is_removed_from_combat, conditions FROM initiative_tracker WHERE id = ?',
        [initiativeId]
      );
      expect(entry.is_removed_from_combat).toBe(true);

      const conditions = JSON.parse(entry.conditions);
      expect(conditions).toContainEqual('dead');
      expect(conditions).not.toContainEqual('unconscious');
    });

    test('should reject death saves when HP is not 0', async () => {
      // Set HP to 5
      await database.run('UPDATE players SET current_hp = 5 WHERE id = ?', [playerId]);

      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 1,
          death_save_failures: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Death saves only apply when HP is 0');
    });

    test('should reject death saves for non-players', async () => {
      // Create a monster and add to initiative
      const monsterResult = await database.run(
        `INSERT INTO monsters (encounter_id, name, armor_class, max_hp, current_hp)
         VALUES (?, ?, ?, ?, ?)`,
        [encounterId, 'Goblin', 15, 7, 0]
      );
      const monsterId = monsterResult.lastID;

      const initResult = await database.run(
        `INSERT INTO initiative_tracker (encounter_id, participant_type, participant_id, initiative, turn_order)
         VALUES (?, ?, ?, ?, ?)`,
        [encounterId, 'monster', monsterId, 10, 2]
      );
      const monsterInitId = initResult.lastID;

      const response = await request(app)
        .put(`/api/combat/initiative/${monsterInitId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 1,
          death_save_failures: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Death saves only apply to players');
    });

    test('should reject invalid death save values', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          death_save_successes: 5, // Invalid: > 3
          death_save_failures: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .send({
          death_save_successes: 1,
          death_save_failures: 0
        });

      expect(response.status).toBe(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .put(`/api/combat/initiative/${initiativeId}/death-saves`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          death_save_successes: 1,
          death_save_failures: 0
        });

      expect(response.status).toBe(403);
    });
  });
});
