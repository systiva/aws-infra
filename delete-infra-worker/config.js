// Validate required environment variables
const requiredEnvVars = [
  'AWS_REGION',
  'ADMIN_ACCOUNT_ID',
  'ACCOUNT_ACCOUNT_ID',
  'CROSS_ACCOUNT_ROLE_NAME',
  'WORKSPACE',
  'ACCOUNT_REGISTRY_TABLE_NAME'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

module.exports = {
  // AWS Configuration
  AWS: {
    REGION: process.env.AWS_REGION,
    ADMIN_ACCOUNT_ID: process.env.ADMIN_ACCOUNT_ID,
    ACCOUNT_ACCOUNT_ID: process.env.ACCOUNT_ACCOUNT_ID
  },
  
  // Cross-account IAM Configuration
  CROSS_ACCOUNT: {
    ROLE_NAME: process.env.CROSS_ACCOUNT_ROLE_NAME,
    SESSION_NAME: 'delete-dynamodb-worker-session',
    ASSUME_ROLE_DURATION: 3600 // 1 hour
  },
  
  // DynamoDB Configuration
  DYNAMODB: {
    ACCOUNT_REGISTRY_TABLE: process.env.ACCOUNT_REGISTRY_TABLE_NAME,
    ACCOUNT_PUBLIC_TABLE: process.env.ACCOUNT_PUBLIC_DYNAMO_DB,
    REGION: process.env.AWS_REGION
  }
};