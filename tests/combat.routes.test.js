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
  let adminToken, adminUserId;
  let campaignId, encounterId, playerId, monsterId, initiativeId;

  beforeAll(async () => {
    await database.connect();

    // Create schema
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dm_user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS encounters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard', 'deadly')),
        status TEXT CHECK(status IN ('pending', 'active', 'completed')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        user_id INTEGER,
        character_name TEXT NOT NULL,
        character_class TEXT,
        level INTEGER DEFAULT 1,
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        speed INTEGER DEFAULT 30,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS monsters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encounter_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        dnd_api_id TEXT,
        max_hp INTEGER NOT NULL,
        current_hp INTEGER NOT NULL,
        armor_class INTEGER DEFAULT 10,
        initiative_bonus INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS initiative_tracker (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encounter_id INTEGER NOT NULL,
        participant_type TEXT CHECK(participant_type IN ('player', 'monster')),
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT 0,
        conditions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
});
