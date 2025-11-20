module.exports = {
  // IMS Lambda Configuration (Direct Invocation)
  IMS_LAMBDA: {
    FUNCTION_NAME: process.env.IMS_LAMBDA_FUNCTION_NAME || 'dev-admin-portal-ims-service',
    TIMEOUT: parseInt(process.env.IMS_TIMEOUT) || 30000
  },
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};