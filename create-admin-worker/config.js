module.exports = {
  // IMS Service Configuration
  IMS_SERVICE: {
    BASE_URL: process.env.IMS_SERVICE_URL || 'https://api-gateway-url/ims',
    TIMEOUT: parseInt(process.env.IMS_TIMEOUT) || 30000
  },
  
  // Platform Tenant Configuration
  PLATFORM: {
    TENANT_ID: process.env.TENANT_PLATFORM_ID || 'platform',
    ADMIN_GROUP_ID: process.env.TENANT_ADMIN_GROUP_ID || null
  },
  
  // AWS Configuration
  AWS: {
    REGION: process.env.AWS_REGION || 'us-east-1'
  },
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};