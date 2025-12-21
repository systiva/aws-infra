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
    SESSION_NAME: 'poll-infra-worker-session',
    ASSUME_ROLE_DURATION: 3600 // 1 hour
  },
  
  // CloudFormation Polling Configuration
  CLOUDFORMATION: {
    POLL_INTERVAL_SECONDS: 30,
    MAX_POLL_ATTEMPTS: 60, // 30 minutes total
    COMPLETE_STATUSES: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'DELETE_COMPLETE'],
    FAILED_STATUSES: ['CREATE_FAILED', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'DELETE_FAILED'],
    IN_PROGRESS_STATUSES: ['CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'DELETE_IN_PROGRESS']
  },
  
  // DynamoDB Configuration
  DYNAMODB: {
    ACCOUNT_REGISTRY_TABLE: process.env.ACCOUNT_REGISTRY_TABLE_NAME,
    REGION: process.env.AWS_REGION
  }
};