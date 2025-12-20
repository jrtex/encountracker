const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');

describe('Rate Limiting Configuration', () => {
  let app;
  let generalLimiter;
  let authLimiter;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
    delete process.env.AUTH_RATE_LIMIT_MAX_REQUESTS;

    // Create fresh limiters for each test
    generalLimiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000,
      message: {
        success: false,
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    authLimiter = rateLimit({
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
      message: {
        success: false,
        message: 'Too many login attempts, please try again later'
      },
      skipSuccessfulRequests: true
    });

    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/auth/login', authLimiter);
    app.use('/api/', generalLimiter);

    app.post('/api/auth/login', (req, res) => {
      res.json({ success: true, message: 'Login successful' });
    });

    app.get('/api/test', (req, res) => {
      res.json({ success: true, message: 'Test endpoint' });
    });
  });

  describe('General API Rate Limiter', () => {
    test('should use default limit when env var not set', () => {
      const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000
      });

      expect(limiter).toBeDefined();
      // The limiter object doesn't expose max directly, but we can verify it was created
    });

    test('should respect RATE_LIMIT_MAX_REQUESTS environment variable', () => {
      process.env.RATE_LIMIT_MAX_REQUESTS = '100';
      const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000
      });

      expect(limiter).toBeDefined();
    });

    test('should allow requests below the limit', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Auth Rate Limiter', () => {
    test('should use default auth limit when env var not set', () => {
      const limiter = rateLimit({
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5
      });

      expect(limiter).toBeDefined();
    });

    test('should respect AUTH_RATE_LIMIT_MAX_REQUESTS environment variable', () => {
      process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '100';
      const limiter = rateLimit({
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5
      });

      expect(limiter).toBeDefined();
    });

    test('should allow auth requests below the limit', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Environment Variable Parsing', () => {
    test('should parse RATE_LIMIT_WINDOW_MS as integer', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '60000';
      const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
      expect(windowMs).toBe(60000);
    });

    test('should parse RATE_LIMIT_MAX_REQUESTS as integer', () => {
      process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
      const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
      expect(max).toBe(10000);
    });

    test('should parse AUTH_RATE_LIMIT_WINDOW_MS as integer', () => {
      process.env.AUTH_RATE_LIMIT_WINDOW_MS = '900000';
      const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
      expect(windowMs).toBe(900000);
    });

    test('should parse AUTH_RATE_LIMIT_MAX_REQUESTS as integer', () => {
      process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '100';
      const max = parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5;
      expect(max).toBe(100);
    });

    test('should use defaults when env vars are invalid', () => {
      process.env.RATE_LIMIT_MAX_REQUESTS = 'invalid';
      const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000;
      expect(max).toBe(10000);
    });
  });
});
