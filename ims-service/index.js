// Main Lambda handler for Identity Management Service
const serverless = require('serverless-http');
const app = require('./app');
const logger = require('./logger');

// Store Lambda context globally for logging
exports.handler = async (event, context) => {
  // Store context for request logging
  global.lambdaContext = context;
  
  try {
    logger.info('IMS Lambda function invoked', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: context.awsRequestId
    });

    // Use serverless-http to handle the Express app
    const handler = serverless(app);
    const response = await handler(event, context);
    
    logger.info('IMS Lambda function completed', {
      statusCode: response.statusCode,
      requestId: context.awsRequestId
    });

    return response;
  } catch (error) {
    logger.error('IMS Lambda function error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: context.awsRequestId
      })
    };
  }
};