const serverless = require('serverless-http');
const app = require('./app');

// Export Lambda handler
module.exports.handler = serverless(app);
