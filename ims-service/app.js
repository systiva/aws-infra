// Express application for Identity Management Service
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./logger');
const { conditionalAuth } = require('./src/middleware/conditional-auth');
const { conditionalAuthProtected } = require('./src/middleware/conditional-auth-protected');

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const roleRoutes = require('./src/routes/roles');
const contextRoutes = require('./src/routes/context');
const rbacRoutes = require('./src/routes/rbac');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS middleware
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: config.MAX_REQUEST_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_REQUEST_SIZE }));

// Request logging middleware
app.use(logger.requestLogger());

// Public authentication middleware (for health checks and root endpoint)
app.use(conditionalAuth);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ims-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// Root endpoint (public)
app.get('/', (req, res) => {
  res.json({
    service: 'Identity Management Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: `/api/${config.API_VERSION}/auth`,
      users: `/api/${config.API_VERSION}/users`,
      roles: `/api/${config.API_VERSION}/roles`,
      context: `/api/${config.API_VERSION}/context`,
      rbac: `/api/${config.API_VERSION}/rbac`
    }
  });
});

// API versioned routes with mixed authentication
const apiRouter = express.Router();

// Public auth routes (no authentication required)
apiRouter.use('/auth', authRoutes);

// Protected routes require authentication
const protectedRouter = express.Router();
protectedRouter.use(conditionalAuthProtected);

// Mount protected route modules
protectedRouter.use('/users', userRoutes);
protectedRouter.use('/roles', roleRoutes);
protectedRouter.use('/context', contextRoutes);
protectedRouter.use('/rbac', rbacRoutes);

// Mount protected router
apiRouter.use('/', protectedRouter);

// Mount API router
app.use(`/api/${config.API_VERSION}`, apiRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: config.INCLUDE_STACK_TRACE ? error.stack : undefined,
    method: req.method,
    url: req.url
  });

  res.status(error.status || 500).json({
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    ...(config.INCLUDE_STACK_TRACE && { stack: error.stack })
  });
});

module.exports = app;