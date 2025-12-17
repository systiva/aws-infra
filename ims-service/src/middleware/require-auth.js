const logger = require('../../logger');

/**
 * Middleware to require authentication for protected routes
 * Returns 401 if no user context is found
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.sub) {
    logger.warn('Access denied - authentication required', {
      method: req.method,
      url: req.url,
      hasUser: !!req.user,
      userSub: req.user?.sub
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to access this resource'
    });
  }

  // User is authenticated, continue
  next();
};

/**
 * Middleware to optionally authenticate but allow access without authentication
 * Useful for routes that can work with or without user context
 */
const optionalAuth = (req, res, next) => {
  // Always continue, regardless of authentication status
  next();
};

module.exports = { requireAuth, optionalAuth };