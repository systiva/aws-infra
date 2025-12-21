require('dotenv').config();

module.exports = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3002,
    
    // AWS Configuration
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    
    // DynamoDB Tables
    ACCOUNT_REGISTRY_TABLE: process.env.ACCOUNT_REGISTRY_TABLE || 'AccountRegistry',
    
    // Cross-Account Role Configuration
    CROSS_ACCOUNT_ROLE_NAME: process.env.CROSS_ACCOUNT_ROLE_NAME || 'dev-CrossAccountAccountRole',
    CROSS_ACCOUNT_EXTERNAL_ID: process.env.CROSS_ACCOUNT_EXTERNAL_ID || 'account-provisioning',
    ASSUME_ROLE_DURATION: process.env.ASSUME_ROLE_DURATION || 3600, // 1 hour
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // API Configuration
    API_VERSION: 'v1',
    API_PREFIX: '/api/v1/oms',
    
    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100
};
