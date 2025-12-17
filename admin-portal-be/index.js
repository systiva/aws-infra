const serverless = require('serverless-http');
const app = require('./app');
const index = serverless(app);

module.exports.handler = async (event, context) => {
  // Log the incoming event and URL
  console.log('Incoming Event:', JSON.stringify(event, null, 2));
  return await index(event, context);
};