const request = require('supertest');
const express = require('express');
const monsterRoutes = require('../server/routes/monsters');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/monsters', monsterRoutes);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Monster Actions Routes', () => {
  let adminToken, adminUserId;
  let campaignId, encounterId, monsterId;

  beforeAll(async () => {
    await database.connect();

    // Initialize test database schema
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dm_user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dm_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS encounters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
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
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS monster_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monster_id INTEGER NOT NULL,
        action_category TEXT NOT NULL CHECK(action_category IN ('action', 'legendary', 'special', 'reaction')),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clear tables before each test
    await database.run('DELETE FROM monster_actions');
    await database.run('DELETE FROM monsters');
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
      'INSERT INTO encounters (campaign_id, name) VALUES (?, ?)',
      [campaignId, 'Test Encounter']
    );
    encounterId = encounterResult.lastID;

    // Create monster
    const monsterResult = await database.run(
      'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
      [encounterId, 'Goblin', 7, 7, 15]
    );
    monsterId = monsterResult.lastID;
  });

  describe('POST /api/monsters - Create with actions', () => {
    test('should create monster with actions', async () => {
      const monsterData = {
        encounter_id: encounterId,
        name: 'Orc',
        max_hp: 15,
        armor_class: 13,
        initiative_bonus: 0,
        actions: [
          {
            category: 'action',
            name: 'Greataxe',
            description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.'
          },
          {
            category: 'reaction',
            name: 'Parry',
            description: 'The orc adds 2 to its AC against one melee attack that would hit it.'
          }
        ]
      };

      const response = await request(app)
        .post('/api/monsters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(monsterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Orc');
      expect(response.body.data.actions).toBeDefined();
      expect(response.body.data.actions.length).toBe(2);

      const greataxe = response.body.data.actions.find(a => a.name === 'Greataxe');
      expect(greataxe.action_category).toBe('action');
      expect(greataxe.description).toContain('Melee Weapon Attack');

      const parry = response.body.data.actions.find(a => a.name === 'Parry');
      expect(parry.action_category).toBe('reaction');
    });

    test('should create monster without actions', async () => {
      const monsterData = {
        encounter_id: encounterId,
        name: 'Orc',
        max_hp: 15,
        armor_class: 13
      };

      const response = await request(app)
        .post('/api/monsters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(monsterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.actions).toEqual([]);
    });

    test('should reject invalid action category', async () => {
      const monsterData = {
        encounter_id: encounterId,
        name: 'Orc',
        max_hp: 15,
        armor_class: 13,
        actions: [
          {
            category: 'invalid_category',
            name: 'Test',
            description: 'Test description'
          }
        ]
      };

      const response = await request(app)
        .post('/api/monsters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(monsterData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should require authentication', async () => {
      const monsterData = {
        encounter_id: encounterId,
        name: 'Orc',
        max_hp: 15,
        armor_class: 13
      };

      await request(app)
        .post('/api/monsters')
        .send(monsterData)
        .expect(401);
    });
  });

  describe('GET /api/monsters/:id/actions', () => {
    beforeEach(async () => {
      // Add test actions
      await database.run(
        'INSERT INTO monster_actions (monster_id, action_category, name, description) VALUES (?, ?, ?, ?)',
        [monsterId, 'action', 'Scimitar', 'Melee Weapon Attack: +4 to hit']
      );
      await database.run(
        'INSERT INTO monster_actions (monster_id, action_category, name, description) VALUES (?, ?, ?, ?)',
        [monsterId, 'special', 'Nimble Escape', 'Can take Disengage or Hide as bonus action']
      );
      await database.run(
        'INSERT INTO monster_actions (monster_id, action_category, name, description) VALUES (?, ?, ?, ?)',
        [monsterId, 'legendary', 'Detect', 'Make a Wisdom (Perception) check']
      );
    });

    test('should return all actions for a monster', async () => {
      const response = await request(app)
        .get(`/api/monsters/${monsterId}/actions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);

      // Verify ordering: actions, legendary, special, reaction
      const categories = response.body.data.map(a => a.action_category);
      expect(categories[0]).toBe('action');
      expect(categories[1]).toBe('legendary');
      expect(categories[2]).toBe('special');
    });

    test('should return empty array for monster with no actions', async () => {
      // Create new monster without actions
      const result = await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'Rat', 1, 1, 10]
      );

      const response = await request(app)
        .get(`/api/monsters/${result.lastID}/actions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should return 404 for non-existent monster', async () => {
      const response = await request(app)
        .get('/api/monsters/99999/actions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Monster not found');
    });

    test('should require authentication', async () => {
      await request(app)
        .get(`/api/monsters/${monsterId}/actions`)
        .expect(401);
    });
  });

  describe('CASCADE DELETE behavior', () => {
    test('should delete actions when monster is deleted', async () => {
      // Add action
      await database.run(
        'INSERT INTO monster_actions (monster_id, action_category, name, description) VALUES (?, ?, ?, ?)',
        [monsterId, 'action', 'Bite', 'Melee attack']
      );

      // Verify action exists
      const beforeActions = await database.all(
        'SELECT * FROM monster_actions WHERE monster_id = ?',
        [monsterId]
      );
      expect(beforeActions.length).toBe(1);

      // Delete monster
      await database.run('DELETE FROM monsters WHERE id = ?', [monsterId]);

      // Verify actions are deleted
      const afterActions = await database.all(
        'SELECT * FROM monster_actions WHERE monster_id = ?',
        [monsterId]
      );
      expect(afterActions.length).toBe(0);
    });
  });
});
