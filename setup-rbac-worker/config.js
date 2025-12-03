module.exports = {
  // IMS Lambda Configuration
  IMS_LAMBDA: {
    FUNCTION_NAME: process.env.IMS_LAMBDA_FUNCTION_NAME,
    TIMEOUT: parseInt(process.env.IMS_TIMEOUT || '30000')
  },
  
  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
