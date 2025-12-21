// Configuration for Identity Management Service

// Load environment variables from .env file based on NODE_ENV
const path = require('path');

// Load dotenv for development or if no NODE_ENV is set
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config({
    path: path.join(__dirname, '.env.development')
  });
}

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3001,
  
  // Environment settings
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
  
  // AWS Configuration
  AWS_REGION: process.env.REGION || process.env.AWS_REGION || 'us-east-1',
  
  // Cognito Configuration
  USER_POOL_ID: process.env.USER_POOL_ID,
  USER_POOL_CLIENT_ID: process.env.USER_POOL_CLIENT_ID,
  USER_POOL_CLIENT_SECRET: process.env.USER_POOL_CLIENT_SECRET,
  
  // DynamoDB Configuration
  ACCOUNT_REGISTRY_TABLE_NAME: process.env.ACCOUNT_REGISTRY_TABLE_NAME,
  
  // Platform Configuration
  PLATFORM_ACCOUNT_ID: process.env.PLATFORM_ACCOUNT_ID || 'platform',
  
  // API Configuration
  API_VERSION: 'v1',
  MAX_REQUEST_SIZE: '10mb',
  REQUEST_TIMEOUT: 30000,
  
  // Security Configuration
  JWT_ALGORITHM: 'HS256', // Changed to HS256 for simplicity, could be RS256 for production
  JWT_SIGNING_KEY: process.env.JWT_SIGNING_KEY,
  JWT_ISSUER: process.env.JWT_ISSUER || 'ims-service',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'admin-portal',
  JWT_ACCESS_TOKEN_EXPIRES_IN: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h',
  JWT_REFRESH_TOKEN_EXPIRES_IN: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
  PASSWORD_MIN_LENGTH: 12,
  MFA_ENABLED: true,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // per window
  
  // Password Policy
  DEFAULT_TEMP_PASSWORD_LENGTH: 12,
  PASSWORD_POLICY: {
    minimumLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true
  },
  TEMP_PASSWORD_VALIDITY_DAYS: 7,
  
  // CORS Configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  
  // Logging Configuration
  LOG_REQUESTS: true,
  LOG_RESPONSES: process.env.NODE_ENV === 'development',
  
  // Error Handling
  INCLUDE_STACK_TRACE: process.env.NODE_ENV === 'development'
};

// Validation
if (!config.USER_POOL_ID) {
  throw new Error('USER_POOL_ID environment variable is required');
}

if (!config.USER_POOL_CLIENT_ID) {
  throw new Error('USER_POOL_CLIENT_ID environment variable is required');
}

if (!config.USER_POOL_CLIENT_SECRET) {
  throw new Error('USER_POOL_CLIENT_SECRET environment variable is required');
}

module.exports = config;