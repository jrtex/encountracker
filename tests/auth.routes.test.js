const request = require('supertest');
const express = require('express');
const authRoutes = require('../server/routes/auth');
const database = require('../server/utils/database');
const { generateToken } = require('../server/utils/jwt');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Error handler for tests
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

describe('Auth Routes', () => {
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
      )
    `);
  });

  beforeEach(async () => {
    // Clear users table before each test
    await database.run('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toMatchObject({
        username: 'testuser',
        email: 'test@example.com',
        role: 'player'
      });
      expect(response.body.data.id).toBeDefined();
    });

    test('should reject registration with short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'username',
            message: 'Username must be at least 3 characters'
          })
        ])
      );
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Invalid email address'
          })
        ])
      );
    });

    test('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '12345'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: 'Password must be at least 6 characters'
          })
        ])
      );
    });

    test('should reject duplicate username', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test1@example.com',
          password: 'password123'
        });

      // Try to create user with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test2@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Username or email already exists');
    });

    test('should reject duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser1',
          email: 'test@example.com',
          password: 'password123'
        });

      // Try to create user with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Username or email already exists');
    });

    test('should hash password before storing', async () => {
      const password = 'password123';

      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password
        });

      // Verify password is hashed in database
      const user = await database.get(
        'SELECT password_hash FROM users WHERE username = ?',
        ['testuser']
      );

      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(password);
      expect(user.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.token).toBeDefined();
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.user).toMatchObject({
        username: 'testuser',
        email: 'test@example.com',
        role: 'player'
      });
    });

    test('should reject login with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should reject login with empty username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject login with empty password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      const token = response.body.data.token;
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      // Register and login to get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      userId = registerResponse.body.data.id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    test('should return current user data with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'player'
      });
      expect(response.body.data.created_at).toBeDefined();
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    test('should return 404 if user was deleted', async () => {
      // Delete the user
      await database.run('DELETE FROM users WHERE id = ?', [userId]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get token
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    test('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No token provided');
    });

    test('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
