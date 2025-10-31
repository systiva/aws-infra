#!/usr/bin/env node

// Load environment variables first for local development
const path = require('path');
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config({
    path: path.join(__dirname, '.env.development')
  });
}

// Local development server for IMS Service
const app = require('./app');
const config = require('./config');
const logger = require('./logger');

// Start the server
const server = app.listen(config.PORT, () => {
  logger.info('IMS Service started successfully', {
    port: config.PORT,
    environment: config.NODE_ENV,
    cors: config.CORS_ORIGINS,
    userPoolId: config.USER_POOL_ID,
    tableName: config.TENANT_REGISTRY_TABLE_NAME
  });
  
  console.log(`🚀 IMS Service running on http://localhost:${config.PORT}`);
  console.log(`📝 Environment: ${config.NODE_ENV}`);
  console.log(`🔐 Cognito User Pool: ${config.USER_POOL_ID}`);
  console.log(`🌐 CORS Origins: ${config.CORS_ORIGINS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});