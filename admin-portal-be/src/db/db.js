const dynamoose = require('dynamoose');
const Logger = require('../../logger');

// Only require config for local development
const env = process.env.ENV ? process.env.ENV.trim().toLowerCase() : null;
Logger.info(`ENV: ${env}`);

// Set table name based on environment
const TABLE_NAME = 'platform-admin';
Logger.info(`DynamoDB Table: ${TABLE_NAME}`);

// Configure DynamoDB connection based on environment
let ddbConfig = {
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
};

if (env === 'local') {
  // Local development with DynamoDB Local
  ddbConfig.endpoint = 'http://localhost:8000';
  ddbConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fake-access-key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fake-secret-key'
  };
} else if (['dev', 'qa', 'uat', 'prod', 'production'].includes(env)) {
  // AWS environments - use IAM role credentials
  // Don't set explicit credentials, let AWS SDK use IAM role
  ddbConfig.endpoint = `https://dynamodb.${ddbConfig.region}.amazonaws.com`;
} else if (!env) {
  // Default to AWS environment if no ENV is set (Lambda default)
  Logger.info('No ENV specified, defaulting to AWS environment');
  ddbConfig.endpoint = `https://dynamodb.${ddbConfig.region}.amazonaws.com`;
} else {
  throw new Error(`Unsupported ENV value: ${env}. Supported values: local, dev, qa, uat, prod`);
}

const ddb = new dynamoose.aws.ddb.DynamoDB(ddbConfig);

// Set DynamoDB instance for dynamoose
dynamoose.aws.ddb.set(ddb);

// Log connection details
if (env === 'local') {
  Logger.info('🔧 Connecting to DynamoDB Local at http://localhost:8000');
  Logger.info(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID}`);
  Logger.info(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '***' : 'NOT_SET'}`);
} else {
  Logger.info(`☁️ Connecting to AWS DynamoDB in region: ${ddbConfig.region}`);
  Logger.info('🔐 Using IAM role credentials (no explicit access keys)');
}

const dbSchema = new dynamoose.Schema(
  {
    pk: {
      type: String,
      hashKey: true,
    },
    sk: {
      type: String,
      rangeKey: true,
      required: true,
    },
  },
  {
    saveUnknown: ['*.**'],
  },
);

Logger.info(`Connected to DynamoDB Table: ${TABLE_NAME}`);
module.exports = dynamoose.model(TABLE_NAME, dbSchema, {
  create: env === 'local' ? true : false, // Auto-create table in local environment
  update: env === 'local' ? true : false, // Auto-update table schema in local environment
});
