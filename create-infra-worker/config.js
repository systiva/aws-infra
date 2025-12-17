// Validate required environment variables
const requiredEnvVars = [
  'AWS_REGION',
  'ADMIN_ACCOUNT_ID',
  'TENANT_ACCOUNT_ID',
  'CROSS_ACCOUNT_ROLE_NAME',
  'WORKSPACE',
  'TENANT_REGISTRY_TABLE_NAME'
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
    TENANT_ACCOUNT_ID: process.env.TENANT_ACCOUNT_ID
  },
  
  // Cross-account IAM Configuration
  CROSS_ACCOUNT: {
    ROLE_NAME: process.env.CROSS_ACCOUNT_ROLE_NAME,
    SESSION_NAME: 'create-infra-worker-session',
    ASSUME_ROLE_DURATION: 3600 // 1 hour
  },
  
  // CloudFormation Configuration (DynamoDB table creation only)
  CLOUDFORMATION: {
    STACK_NAME_PREFIX: 'tenant-dynamodb',
    TIMEOUT_MINUTES: 10, // Reduced timeout for DynamoDB-only stacks
    CAPABILITIES: [] // No special capabilities needed for DynamoDB
  },
  
  // DynamoDB Configuration
  DYNAMODB: {
    TENANT_REGISTRY_TABLE: process.env.TENANT_REGISTRY_TABLE_NAME,
    TENANT_PUBLIC_TABLE: process.env.TENANT_PUBLIC_DYNAMO_DB,
    REGION: process.env.AWS_REGION
  },
  
  // Tenant Configuration
  TENANT: {
    SUBSCRIPTION_TIERS: {
      PUBLIC: 'public',
      PRIVATE: 'private'
    }
  }
};