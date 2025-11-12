module.exports = {
  // IMS Lambda Configuration (Direct Invocation)
  IMS_LAMBDA: {
    FUNCTION_NAME: process.env.IMS_LAMBDA_FUNCTION_NAME || 'dev-admin-portal-ims-service',
    TIMEOUT: parseInt(process.env.IMS_TIMEOUT) || 30000
  },
  
  // Platform Tenant Configuration
  PLATFORM: {
    TENANT_ID: process.env.TENANT_PLATFORM_ID || 'platform',
    ADMIN_GROUP_ID: process.env.TENANT_ADMIN_GROUP_ID || null
  },
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};