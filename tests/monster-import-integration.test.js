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

describe('Monster Import Integration Test', () => {
  let adminToken, adminUserId, campaignId, encounterId;

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
  });

  test('should import monster with all action types from D&D API format', async () => {
    // Simulate D&D 5e API monster data structure (as extracted by frontend)
    const goblinData = {
      encounter_id: encounterId,
      name: 'Goblin #1',
      max_hp: 7,
      armor_class: 15,
      initiative_bonus: 2,
      dnd_api_id: 'goblin',
      notes: 'Small humanoid (CR 1/4)',
      actions: [
        {
          category: 'action',
          name: 'Scimitar',
          description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.'
        },
        {
          category: 'action',
          name: 'Shortbow',
          description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.'
        },
        {
          category: 'special',
          name: 'Nimble Escape',
          description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'
        }
      ]
    };

    // Create monster
    const createResponse = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(goblinData)
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.name).toBe('Goblin #1');
    expect(createResponse.body.data.dnd_api_id).toBe('goblin');

    const createdMonsterId = createResponse.body.data.id;

    // Verify actions were created
    expect(createResponse.body.data.actions).toBeDefined();
    expect(createResponse.body.data.actions.length).toBe(3);

    // Retrieve actions via GET endpoint
    const actionsResponse = await request(app)
      .get(`/api/monsters/${createdMonsterId}/actions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(actionsResponse.body.success).toBe(true);
    expect(actionsResponse.body.data.length).toBe(3);

    // Verify action categories are ordered correctly (action, legendary, special, reaction)
    const categories = actionsResponse.body.data.map(a => a.action_category);
    expect(categories[0]).toBe('action');
    expect(categories[1]).toBe('action');
    expect(categories[2]).toBe('special');

    // Verify action details
    const scimitar = actionsResponse.body.data.find(a => a.name === 'Scimitar');
    expect(scimitar).toBeDefined();
    expect(scimitar.action_category).toBe('action');
    expect(scimitar.description).toContain('Melee Weapon Attack');

    const nimbleEscape = actionsResponse.body.data.find(a => a.name === 'Nimble Escape');
    expect(nimbleEscape).toBeDefined();
    expect(nimbleEscape.action_category).toBe('special');
    expect(nimbleEscape.description).toContain('Disengage or Hide');
  });

  test('should import complex monster with legendary actions', async () => {
    // Simulate Ancient Red Dragon with legendary actions
    const dragonData = {
      encounter_id: encounterId,
      name: 'Ancient Red Dragon',
      max_hp: 546,
      armor_class: 22,
      initiative_bonus: 0,
      dnd_api_id: 'ancient-red-dragon',
      notes: 'Gargantuan dragon (CR 24)',
      actions: [
        {
          category: 'action',
          name: 'Multiattack',
          description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.'
        },
        {
          category: 'action',
          name: 'Bite',
          description: 'Melee Weapon Attack: +17 to hit, reach 15 ft., one target. Hit: 21 (2d10 + 10) piercing damage plus 14 (4d6) fire damage.'
        },
        {
          category: 'legendary',
          name: 'Detect',
          description: 'The dragon makes a Wisdom (Perception) check.'
        },
        {
          category: 'legendary',
          name: 'Tail Attack',
          description: 'The dragon makes a tail attack.'
        },
        {
          category: 'legendary',
          name: 'Wing Attack (Costs 2 Actions)',
          description: 'The dragon beats its wings. Each creature within 15 ft. of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone.'
        },
        {
          category: 'special',
          name: 'Legendary Resistance (3/Day)',
          description: 'If the dragon fails a saving throw, it can choose to succeed instead.'
        },
        {
          category: 'reaction',
          name: 'Tail Swipe',
          description: 'When a creature the dragon can see within 10 feet of it hits it with a melee attack, the dragon can make a tail attack against that creature.'
        }
      ]
    };

    // Create monster
    const createResponse = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(dragonData)
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.actions.length).toBe(7);

    // Verify all action categories are present
    const actionCategories = createResponse.body.data.actions.map(a => a.action_category);
    expect(actionCategories).toContain('action');
    expect(actionCategories).toContain('legendary');
    expect(actionCategories).toContain('special');
    expect(actionCategories).toContain('reaction');

    // Count each category
    const categoryCounts = {
      action: actionCategories.filter(c => c === 'action').length,
      legendary: actionCategories.filter(c => c === 'legendary').length,
      special: actionCategories.filter(c => c === 'special').length,
      reaction: actionCategories.filter(c => c === 'reaction').length
    };

    expect(categoryCounts.action).toBe(2);
    expect(categoryCounts.legendary).toBe(3);
    expect(categoryCounts.special).toBe(1);
    expect(categoryCounts.reaction).toBe(1);
  });

  test('should handle duplicate monsters with same actions', async () => {
    // Create two goblins - they should each have their own set of actions
    const goblinData = {
      encounter_id: encounterId,
      name: 'Goblin',
      max_hp: 7,
      armor_class: 15,
      initiative_bonus: 2,
      dnd_api_id: 'goblin',
      notes: 'Small humanoid (CR 1/4)',
      actions: [
        {
          category: 'action',
          name: 'Scimitar',
          description: 'Melee Weapon Attack: +4 to hit'
        }
      ]
    };

    // Create first goblin
    const goblin1Response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(goblinData)
      .expect(201);

    const goblin1Id = goblin1Response.body.data.id;

    // Create second goblin (same data)
    const goblin2Response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...goblinData, name: 'Goblin #2' })
      .expect(201);

    const goblin2Id = goblin2Response.body.data.id;

    // Both should have actions
    expect(goblin1Response.body.data.actions.length).toBe(1);
    expect(goblin2Response.body.data.actions.length).toBe(1);

    // Action IDs should be different
    expect(goblin1Response.body.data.actions[0].id).not.toBe(goblin2Response.body.data.actions[0].id);

    // Delete first goblin
    await database.run('DELETE FROM monsters WHERE id = ?', [goblin1Id]);

    // Second goblin's actions should still exist
    const goblin2Actions = await database.all(
      'SELECT * FROM monster_actions WHERE monster_id = ?',
      [goblin2Id]
    );
    expect(goblin2Actions.length).toBe(1);
  });
});
