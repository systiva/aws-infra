const dynamoose = require('dynamoose');
const logger = require('../../logger');

// Only require config for local development
const env = process.env.ENV ? process.env.ENV.trim().toLowerCase() : null;
logger.info(`ENV: ${env}`);

// Set table name based on environment
const TABLE_NAME = process.env.RBAC_TABLE_NAME || 'admin-portal-dev-tenant-registry';
logger.info(`DynamoDB Table: ${TABLE_NAME}`);

// Configure DynamoDB connection based on environment
let ddbConfig = {
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
};

if (env === 'local') {
  // Local development - use IAM role credentials (no fake credentials)
  // This will use the AWS credentials from your local environment (AWS CLI, IAM role, etc.)
  ddbConfig.endpoint = `https://dynamodb.${ddbConfig.region}.amazonaws.com`;
  logger.info('Using local development with IAM role credentials');
} else if (['dev', 'qa', 'uat', 'prod', 'production'].includes(env)) {
  // AWS environments - use IAM role credentials
  // Don't set explicit credentials, let AWS SDK use IAM role
  ddbConfig.endpoint = `https://dynamodb.${ddbConfig.region}.amazonaws.com`;
} else if (!env) {
  // Default to AWS environment if no ENV is set (Lambda default)
  logger.info('No ENV specified, defaulting to AWS environment');
  ddbConfig.endpoint = `https://dynamodb.${ddbConfig.region}.amazonaws.com`;
} else {
  throw new Error(`Unsupported ENV value: ${env}. Supported values: local, dev, qa, uat, prod`);
}

const ddb = new dynamoose.aws.ddb.DynamoDB(ddbConfig);

// Set DynamoDB instance for dynamoose
dynamoose.aws.ddb.set(ddb);

// Log connection details
if (env === 'local') {
  logger.info(`☁️ Connecting to AWS DynamoDB in region: ${ddbConfig.region}`);
  logger.info('🔐 Using local AWS credentials (AWS CLI, IAM role, etc.)');
  logger.info(`Endpoint: ${ddbConfig.endpoint}`);
} else {
  logger.info(`☁️ Connecting to AWS DynamoDB in region: ${ddbConfig.region}`);
  logger.info('🔐 Using IAM role credentials (no explicit access keys)');
}

// RBAC Schema Definition (centralized)
const rbacSchema = new dynamoose.Schema(
  {
    PK: {
      type: String,
      hashKey: true,
    },
    SK: {
      type: String,
      rangeKey: true,
      required: true,
    },
  },
  {
    saveUnknown: ['*.**'], // Allow all unknown attributes
  }
);

logger.info(`Connected to DynamoDB Table: ${TABLE_NAME}`);
const RBACModel = dynamoose.model(TABLE_NAME, rbacSchema, {
  create: false, // Don't auto-create table - should exist in AWS
  update: false, // Don't auto-update table schema
});

module.exports = {
  dynamoose,
  rbacSchema,
  RBACModel
};