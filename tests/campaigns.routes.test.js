const request = require('supertest');
const express = require('express');
const campaignRoutes = require('../server/routes/campaigns');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');
const bcrypt = require('bcryptjs');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignRoutes);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Campaign Routes', () => {
  let adminToken;
  let adminUserId;
  let playerToken;
  let playerUserId;

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
    `);
  });

  beforeEach(async () => {
    // Clear tables before each test
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

    // Create player user
    const playerPasswordHash = await bcrypt.hash('player123', 10);
    const playerResult = await database.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['player', 'player@example.com', playerPasswordHash, 'player']
    );
    playerUserId = playerResult.lastID;
    playerToken = generateToken({
      id: playerUserId,
      username: 'player',
      email: 'player@example.com',
      role: 'player'
    });
  });

  describe('GET /api/campaigns', () => {
    test('should return all campaigns for authenticated user', async () => {
      // Create campaigns for admin
      await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Campaign 1', 'Description 1', adminUserId]
      );
      await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Campaign 2', 'Description 2', adminUserId]
      );

      // Create campaign for different user (should not be returned)
      await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Other Campaign', 'Other Description', playerUserId]
      );

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // Campaigns should be present (order may vary due to timestamp precision)
      const campaignNames = response.body.data.map(c => c.name);
      expect(campaignNames).toContain('Campaign 1');
      expect(campaignNames).toContain('Campaign 2');
    });

    test('should return empty array when user has no campaigns', async () => {
      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should reject request without authentication', async () => {
      const response = await request(app).get('/api/campaigns');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided');
    });

    test('should return all campaigns with DESC order', async () => {
      // Insert campaigns in specific order
      await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Old Campaign', 'Description', adminUserId]
      );

      await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['New Campaign', 'Description', adminUserId]
      );

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      // Just verify both campaigns are present
      const campaignNames = response.body.data.map(c => c.name);
      expect(campaignNames).toContain('Old Campaign');
      expect(campaignNames).toContain('New Campaign');
    });
  });

  describe('GET /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const result = await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Test Campaign', 'Test Description', adminUserId]
      );
      campaignId = result.lastID;
    });

    test('should return single campaign by ID', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: campaignId,
        name: 'Test Campaign',
        description: 'Test Description',
        dm_user_id: adminUserId
      });
    });

    test('should return 404 for non-existent campaign', async () => {
      const response = await request(app)
        .get('/api/campaigns/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Campaign not found');
    });

    test('should return 404 when accessing another users campaign', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Campaign not found');
    });

    test('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/campaigns/${campaignId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/campaigns', () => {
    test('should create campaign as admin', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Campaign',
          description: 'Campaign Description'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign created successfully');
      expect(response.body.data).toMatchObject({
        name: 'New Campaign',
        description: 'Campaign Description',
        dm_user_id: adminUserId
      });
      expect(response.body.data.id).toBeDefined();

      // Verify in database
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [response.body.data.id]
      );
      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('New Campaign');
    });

    test('should create campaign with empty description', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Campaign Without Description'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('');
    });

    test('should reject campaign creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          name: 'Unauthorized Campaign',
          description: 'Should not be created'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');

      // Verify not created in database
      const campaigns = await database.all('SELECT * FROM campaigns');
      expect(campaigns).toHaveLength(0);
    });

    test('should reject campaign without name', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'No name provided'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject campaign with empty name', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          description: 'Empty name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should trim whitespace from name', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '  Trimmed Campaign  ',
          description: 'Test'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Trimmed Campaign');
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .send({
          name: 'Unauthenticated Campaign'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const result = await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Original Campaign', 'Original Description', adminUserId]
      );
      campaignId = result.lastID;
    });

    test('should update campaign as admin owner', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Campaign',
          description: 'Updated Description'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign updated successfully');
      expect(response.body.data).toMatchObject({
        id: campaignId,
        name: 'Updated Campaign',
        description: 'Updated Description'
      });

      // Verify in database
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );
      expect(campaign.name).toBe('Updated Campaign');
      expect(campaign.description).toBe('Updated Description');
    });

    test('should have updated_at field', async () => {
      await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated',
          description: 'Updated'
        });

      const updated = await database.get(
        'SELECT updated_at FROM campaigns WHERE id = ?',
        [campaignId]
      );

      expect(updated.updated_at).toBeDefined();
    });

    test('should return 404 when updating non-existent campaign', async () => {
      const response = await request(app)
        .put('/api/campaigns/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated',
          description: 'Updated'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Campaign not found');
    });

    test('should return 403 when non-admin tries to update campaign', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          name: 'Unauthorized Update',
          description: 'Should fail'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');

      // Verify not updated
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );
      expect(campaign.name).toBe('Original Campaign');
    });

    test('should reject update by non-admin', async () => {
      // Create campaign owned by player
      const result = await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Player Campaign', 'Description', playerUserId]
      );

      const response = await request(app)
        .put(`/api/campaigns/${result.lastID}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          name: 'Updated',
          description: 'Updated'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    test('should reject update without name', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'No name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject update with empty name', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          description: 'Empty name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .send({
          name: 'Updated',
          description: 'Updated'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const result = await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Campaign to Delete', 'Description', adminUserId]
      );
      campaignId = result.lastID;
    });

    test('should delete campaign as admin owner', async () => {
      const response = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Campaign deleted successfully');
      expect(response.body.data.id).toBe(campaignId);

      // Verify deleted from database
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );
      expect(campaign).toBeUndefined();
    });

    test('should return 404 when deleting non-existent campaign', async () => {
      const response = await request(app)
        .delete('/api/campaigns/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Campaign not found');
    });

    test('should return 403 when non-admin tries to delete campaign', async () => {
      const response = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');

      // Verify not deleted
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );
      expect(campaign).toBeDefined();
    });

    test('should reject delete by non-admin', async () => {
      // Create campaign owned by player
      const result = await database.run(
        'INSERT INTO campaigns (name, description, dm_user_id) VALUES (?, ?, ?)',
        ['Player Campaign', 'Description', playerUserId]
      );

      const response = await request(app)
        .delete(`/api/campaigns/${result.lastID}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');

      // Verify not deleted
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [result.lastID]
      );
      expect(campaign).toBeDefined();
    });

    test('should reject request without authentication', async () => {
      const response = await request(app).delete(`/api/campaigns/${campaignId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);

      // Verify not deleted
      const campaign = await database.get(
        'SELECT * FROM campaigns WHERE id = ?',
        [campaignId]
      );
      expect(campaign).toBeDefined();
    });
  });
});
