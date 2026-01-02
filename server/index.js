require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const net = require('net');
const database = require('./utils/database');
const logger = require('./utils/logger');
const initializeDatabase = require('./utils/initDatabase');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { limiter, authLimiter } = require('../config/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const encounterRoutes = require('./routes/encounters');
const playerRoutes = require('./routes/players');
const monsterRoutes = require('./routes/monsters');
const combatRoutes = require('./routes/combat');
const importExportRoutes = require('./routes/importExport');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL_PATH = process.env.BASE_URL_PATH || '/';

// Trust proxy when behind reverse proxy (nginx, load balancer, etc.)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to avoid blocking resources
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', limiter);

// Serve static files
app.use(BASE_URL_PATH, express.static(path.join(__dirname, '../client')));

// API Routes
app.use(`${BASE_URL_PATH}api/public`, publicRoutes); // Public routes (no auth required)
app.use(`${BASE_URL_PATH}api/auth`, authRoutes);
app.use(`${BASE_URL_PATH}api/campaigns`, campaignRoutes);
app.use(`${BASE_URL_PATH}api/encounters`, encounterRoutes);
app.use(`${BASE_URL_PATH}api/players`, playerRoutes);
app.use(`${BASE_URL_PATH}api/monsters`, monsterRoutes);
app.use(`${BASE_URL_PATH}api/combat`, combatRoutes);
app.use(`${BASE_URL_PATH}api/import-export`, importExportRoutes);

// Health check endpoint
app.get(`${BASE_URL_PATH}api/health`, (req, res) => {
  res.json({
    success: true,
    message: 'D&D Encounter Manager API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Public encounter view (no authentication required)
app.get(`${BASE_URL_PATH}public`, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public.html'));
});

// Serve index.html for all other routes (SPA support)
// Express 5 compatible - use middleware instead of wildcard route
app.use((req, res, next) => {
  // Only serve index.html for non-API routes
  const apiPath = `${BASE_URL_PATH}api`.replace(/\/+/g, '/');
  if (!req.path.startsWith(apiPath)) {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  } else {
    next();
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Check if port is already in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Initialize database and start server
async function startServer() {
  try {
    logger.info('Starting D&D Encounter Manager...');

    // Check if port is already in use
    const portInUse = await isPortInUse(PORT);
    if (portInUse) {
      const errorMsg = `Port ${PORT} is already in use. Another instance may be running.`;
      logger.error(errorMsg);
      console.error(`\n❌ ERROR: ${errorMsg}\n`);
      console.error('To fix this:');
      console.error(`  1. Run "npm run stop" to kill existing processes on port ${PORT}`);
      console.error(`  2. Or manually kill the process using the port`);
      console.error(`  3. Then run "npm run dev" again\n`);
      process.exit(1);
    }

    // Connect to database
    await database.connect();

    // Initialize database (create base tables if needed)
    await initializeDatabase();

    // Run database migrations (add new columns/tables)
    const { runMigrations } = require('./utils/migrationRunner');
    await runMigrations();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Base URL path: ${BASE_URL_PATH}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\nServer is running at http://localhost:${PORT}${BASE_URL_PATH}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();

module.exports = app;
