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

describe('Monster Death Saves Feature', () => {
  let adminToken, adminUserId, campaignId, encounterId;

  beforeAll(async () => {
    await database.connect();

    // Drop existing tables to ensure clean schema
    await database.exec(`
      DROP TABLE IF EXISTS monster_actions CASCADE;
      DROP TABLE IF EXISTS monsters CASCADE;
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

      CREATE TABLE monster_actions (
        id SERIAL PRIMARY KEY,
        monster_id INTEGER NOT NULL,
        action_category VARCHAR(50) NOT NULL CHECK(action_category IN ('action', 'legendary', 'special', 'reaction')),
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
      );
    `);
  });

  beforeEach(async () => {
    // Clear tables before each test
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

  test('should create monster with allow_death_saves = true', async () => {
    const monsterData = {
      encounter_id: encounterId,
      name: 'Important NPC',
      max_hp: 50,
      armor_class: 15,
      initiative_bonus: 2,
      allow_death_saves: true
    };

    const response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(monsterData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.allow_death_saves).toBe(true);

    // Verify in database
    const monster = await database.get(
      'SELECT * FROM monsters WHERE id = ?',
      [response.body.data.id]
    );
    expect(monster.allow_death_saves).toBe(true);
  });

  test('should create monster with allow_death_saves = false', async () => {
    const monsterData = {
      encounter_id: encounterId,
      name: 'Regular Goblin',
      max_hp: 7,
      armor_class: 15,
      initiative_bonus: 2,
      allow_death_saves: false
    };

    const response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(monsterData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.allow_death_saves).toBe(false);

    // Verify in database
    const monster = await database.get(
      'SELECT * FROM monsters WHERE id = ?',
      [response.body.data.id]
    );
    expect(monster.allow_death_saves).toBe(false);
  });

  test('should default allow_death_saves to false when not specified', async () => {
    const monsterData = {
      encounter_id: encounterId,
      name: 'Orc',
      max_hp: 15,
      armor_class: 13,
      initiative_bonus: 1
      // allow_death_saves not specified
    };

    const response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(monsterData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.allow_death_saves).toBe(false);

    // Verify in database
    const monster = await database.get(
      'SELECT * FROM monsters WHERE id = ?',
      [response.body.data.id]
    );
    expect(monster.allow_death_saves).toBe(false);
  });

  test('should update monster to enable allow_death_saves', async () => {
    // Create monster with allow_death_saves = false
    const createResponse = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        encounter_id: encounterId,
        name: 'Werewolf',
        max_hp: 58,
        armor_class: 12,
        initiative_bonus: 1,
        allow_death_saves: false
      })
      .expect(201);

    const monsterId = createResponse.body.data.id;

    // Update to allow death saves
    const updateResponse = await request(app)
      .put(`/api/monsters/${monsterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        allow_death_saves: true
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.allow_death_saves).toBe(true);

    // Verify in database
    const monster = await database.get(
      'SELECT * FROM monsters WHERE id = ?',
      [monsterId]
    );
    expect(monster.allow_death_saves).toBe(true);
  });

  test('should update monster to disable allow_death_saves', async () => {
    // Create monster with allow_death_saves = true
    const createResponse = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        encounter_id: encounterId,
        name: 'Vampire Spawn',
        max_hp: 82,
        armor_class: 15,
        initiative_bonus: 3,
        allow_death_saves: true
      })
      .expect(201);

    const monsterId = createResponse.body.data.id;

    // Update to disallow death saves
    const updateResponse = await request(app)
      .put(`/api/monsters/${monsterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        allow_death_saves: false
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.allow_death_saves).toBe(false);

    // Verify in database
    const monster = await database.get(
      'SELECT * FROM monsters WHERE id = ?',
      [monsterId]
    );
    expect(monster.allow_death_saves).toBe(false);
  });

  test('should reject invalid allow_death_saves value', async () => {
    const monsterData = {
      encounter_id: encounterId,
      name: 'Troll',
      max_hp: 84,
      armor_class: 15,
      initiative_bonus: 0,
      allow_death_saves: 'invalid' // Should be boolean
    };

    const response = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(monsterData)
      .expect(400);

    expect(response.body.success).toBe(false);
    // Validation middleware returns generic "Validation failed" message
    expect(response.body.message).toContain('Validation failed');
  });

  test('should retrieve monster with allow_death_saves field', async () => {
    // Create monster with allow_death_saves = true
    const createResponse = await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        encounter_id: encounterId,
        name: 'Lich',
        max_hp: 135,
        armor_class: 17,
        initiative_bonus: 4,
        allow_death_saves: true
      })
      .expect(201);

    // Get all monsters for encounter
    const listResponse = await request(app)
      .get(`/api/monsters?encounter_id=${encounterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.length).toBe(1);
    expect(listResponse.body.data[0].allow_death_saves).toBe(true);
  });

  test('should handle multiple monsters with different allow_death_saves values', async () => {
    // Create monster with death saves enabled
    await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        encounter_id: encounterId,
        name: 'Boss Villain',
        max_hp: 200,
        armor_class: 18,
        initiative_bonus: 5,
        allow_death_saves: true
      })
      .expect(201);

    // Create monster without death saves
    await request(app)
      .post('/api/monsters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        encounter_id: encounterId,
        name: 'Minion',
        max_hp: 10,
        armor_class: 12,
        initiative_bonus: 1,
        allow_death_saves: false
      })
      .expect(201);

    // Get all monsters
    const listResponse = await request(app)
      .get(`/api/monsters?encounter_id=${encounterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.length).toBe(2);

    const boss = listResponse.body.data.find(m => m.name === 'Boss Villain');
    const minion = listResponse.body.data.find(m => m.name === 'Minion');

    expect(boss.allow_death_saves).toBe(true);
    expect(minion.allow_death_saves).toBe(false);
  });
});
