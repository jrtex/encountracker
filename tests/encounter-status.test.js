const request = require('supertest');
const express = require('express');
const encounterRoutes = require('../server/routes/encounters');
const combatRoutes = require('../server/routes/combat');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/encounters', encounterRoutes);
app.use('/api/combat', combatRoutes);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Encounter Status Management', () => {
  let adminToken;
  let adminUserId;
  let campaign1Id;
  let campaign2Id;

  beforeAll(async () => {
    await database.connect();

    // Initialize test database schema
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
        name TEXT NOT NULL,
        description TEXT,
        dm_user_id INTEGER NOT NULL,
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
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'completed')),
        current_round INTEGER DEFAULT 1,
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
        armor_class INTEGER NOT NULL,
        initiative_bonus INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        speed INTEGER DEFAULT 30,
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
        max_hp INTEGER DEFAULT 10,
        current_hp INTEGER DEFAULT 10,
        armor_class INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS initiative_tracker (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        encounter_id INTEGER NOT NULL,
        participant_type TEXT NOT NULL CHECK(participant_type IN ('player', 'monster')),
        participant_id INTEGER NOT NULL,
        initiative INTEGER NOT NULL,
        turn_order INTEGER NOT NULL,
        is_current_turn BOOLEAN DEFAULT 0,
        conditions TEXT DEFAULT '[]',
        FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
      );
    `);

  });

  beforeEach(async () => {
    // Clean up all tables before each test
    await database.run('DELETE FROM initiative_tracker');
    await database.run('DELETE FROM monsters');
    await database.run('DELETE FROM encounters');
    await database.run('DELETE FROM players');
    await database.run('DELETE FROM campaigns');
    await database.run('DELETE FROM users');

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminResult = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['testadmin', 'admin@test.com', passwordHash, 'admin']
    );
    adminUserId = adminResult.lastID;
    adminToken = generateToken({ id: adminUserId, username: 'testadmin', email: 'admin@test.com', role: 'admin' });

    // Create two campaigns
    const campaign1Result = await database.run(
      'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
      ['Test Campaign 1', 'First test campaign', adminUserId]
    );
    campaign1Id = campaign1Result.lastID;

    const campaign2Result = await database.run(
      'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
      ['Test Campaign 2', 'Second test campaign', adminUserId]
    );
    campaign2Id = campaign2Result.lastID;

    // Add test player to campaign 1
    await database.run(
      'INSERT INTO players (campaign_id, character_name, character_class, level, max_hp, current_hp, armor_class, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [campaign1Id, 'Test Fighter', 'Fighter', 1, 10, 10, 16, 1]
    );
  });

  afterAll(async () => {
    await database.close();
  });

  describe('POST /api/encounters - Create Encounter', () => {
    test('should always default new encounters to pending status', async () => {
      const response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          description: 'Test description',
          difficulty: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
    });

    test('should ignore status field in request body', async () => {
      const response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          description: 'Test description',
          difficulty: 'medium',
          status: 'active' // This should be ignored
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending'); // Should still be pending
    });
  });

  describe('PUT /api/encounters/:id - Update Encounter', () => {
    test('should not allow manually changing status via update endpoint', async () => {
      // Create an encounter
      const createResponse = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          difficulty: 'medium'
        });

      const encounterId = createResponse.body.data.id;

      // Try to update status to active
      const updateResponse = await request(app)
        .put(`/api/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Encounter',
          difficulty: 'hard',
          status: 'active' // Should be ignored
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);

      // Verify status is still pending
      const encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('pending');
    });
  });

  describe('POST /api/combat/:encounter_id/start - Start Combat', () => {
    test('should set encounter status to active when starting combat', async () => {
      // Create an encounter
      const createResponse = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          difficulty: 'medium'
        });

      const encounterId = createResponse.body.data.id;

      // Add a monster to the encounter
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'Goblin', 7, 7, 15]
      );

      // Start combat
      const startResponse = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.success).toBe(true);

      // Verify status is now active
      const encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('active');
    });

    test('should deactivate other active encounters in the same campaign when starting combat', async () => {
      // Create two encounters for campaign 1
      const encounter1Response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Encounter 1',
          difficulty: 'medium'
        });
      const encounter1Id = encounter1Response.body.data.id;

      const encounter2Response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Encounter 2',
          difficulty: 'hard'
        });
      const encounter2Id = encounter2Response.body.data.id;

      // Add monsters to both encounters
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounter1Id, 'Goblin 1', 7, 7, 15]
      );
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounter2Id, 'Goblin 2', 7, 7, 15]
      );

      // Manually set encounter 1 to active (simulating existing active encounter)
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['active', encounter1Id]);

      // Start combat on encounter 2
      const startResponse = await request(app)
        .post(`/api/combat/${encounter2Id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.success).toBe(true);

      // Verify encounter 1 is now pending
      const encounter1 = await database.get('SELECT * FROM encounters WHERE id = ?', [encounter1Id]);
      expect(encounter1.status).toBe('pending');

      // Verify encounter 2 is active
      const encounter2 = await database.get('SELECT * FROM encounters WHERE id = ?', [encounter2Id]);
      expect(encounter2.status).toBe('active');
    });

    test('should not affect encounters in other campaigns when starting combat', async () => {
      // Create encounter for campaign 1
      const encounter1Response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Campaign 1 Encounter',
          difficulty: 'medium'
        });
      const encounter1Id = encounter1Response.body.data.id;

      // Create encounter for campaign 2
      const encounter2Response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign2Id,
          name: 'Campaign 2 Encounter',
          difficulty: 'medium'
        });
      const encounter2Id = encounter2Response.body.data.id;

      // Add players to campaign 2
      await database.run(
        'INSERT INTO players (campaign_id, character_name, character_class, level, max_hp, current_hp, armor_class, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [campaign2Id, 'Test Rogue', 'Rogue', 1, 8, 8, 14, 1]
      );

      // Add monsters to both
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounter1Id, 'Goblin 1', 7, 7, 15]
      );
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounter2Id, 'Goblin 2', 7, 7, 15]
      );

      // Set campaign 1 encounter to active
      await database.run('UPDATE encounters SET status = ? WHERE id = ?', ['active', encounter1Id]);

      // Start combat on campaign 2 encounter (should not affect campaign 1)
      const startResponse = await request(app)
        .post(`/api/combat/${encounter2Id}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      expect(startResponse.status).toBe(200);

      // Verify campaign 1 encounter is still active (unaffected)
      const encounter1 = await database.get('SELECT * FROM encounters WHERE id = ?', [encounter1Id]);
      expect(encounter1.status).toBe('active');

      // Verify campaign 2 encounter is active
      const encounter2 = await database.get('SELECT * FROM encounters WHERE id = ?', [encounter2Id]);
      expect(encounter2.status).toBe('active');
    });
  });

  describe('POST /api/combat/:encounter_id/end - End Combat', () => {
    test('should set encounter status back to pending when ending combat', async () => {
      // Create an encounter
      const createResponse = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          difficulty: 'medium'
        });

      const encounterId = createResponse.body.data.id;

      // Add a monster
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'Goblin', 7, 7, 15]
      );

      // Start combat
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      // Verify it's active
      let encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('active');

      // End combat
      const endResponse = await request(app)
        .post(`/api/combat/${encounterId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(endResponse.status).toBe(200);
      expect(endResponse.body.success).toBe(true);
      expect(endResponse.body.data.status).toBe('pending');

      // Verify status is back to pending
      encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('pending');
    });

    test('should allow encounters to be restarted after ending combat', async () => {
      // Create an encounter
      const createResponse = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Test Encounter',
          difficulty: 'medium'
        });

      const encounterId = createResponse.body.data.id;

      // Add a monster
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'Goblin', 7, 7, 15]
      );

      // Start combat
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      // End combat
      await request(app)
        .post(`/api/combat/${encounterId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Start combat again - should work
      const restartResponse = await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      expect(restartResponse.status).toBe(200);
      expect(restartResponse.body.success).toBe(true);

      // Verify status is active again
      const encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('active');
    });
  });

  describe('Encounter Status Lifecycle', () => {
    test('should follow correct status lifecycle: pending -> active -> pending', async () => {
      // Create encounter (pending)
      const createResponse = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          campaign_id: campaign1Id,
          name: 'Lifecycle Test',
          difficulty: 'medium'
        });

      const encounterId = createResponse.body.data.id;
      let encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('pending');

      // Add a monster
      await database.run(
        'INSERT INTO monsters (encounter_id, name, max_hp, current_hp, armor_class) VALUES (?, ?, ?, ?, ?)',
        [encounterId, 'Goblin', 7, 7, 15]
      );

      // Start combat (active)
      await request(app)
        .post(`/api/combat/${encounterId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ initiative_mode: 'auto' });

      encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('active');

      // End combat (back to pending)
      await request(app)
        .post(`/api/combat/${encounterId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      encounter = await database.get('SELECT * FROM encounters WHERE id = ?', [encounterId]);
      expect(encounter.status).toBe('pending');
    });
  });
});
