const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // Very permissive for development/active gameplay
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts default
  message: {
    success: false,
    message: 'Too many login attempts, please try again later'
  },
  skipSuccessfulRequests: true
});

module.exports = {
  limiter,
  authLimiter
};
