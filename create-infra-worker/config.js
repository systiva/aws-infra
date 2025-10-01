module.exports = {
  // AWS Configuration
  AWS: {
    REGION: process.env.AWS_REGION || 'us-east-1',
    ADMIN_ACCOUNT_ID: process.env.ADMIN_ACCOUNT_ID || '583122682394',
    TENANT_ACCOUNT_ID: process.env.TENANT_ACCOUNT_ID || '949642303066'
  },
  
  // Cross-account IAM Configuration
  CROSS_ACCOUNT: {
    ROLE_NAME: process.env.TENANT_ACCOUNT_ROLE_NAME || 'TenantAdminRole',
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
    TENANT_REGISTRY_TABLE: process.env.TENANT_REGISTRY_TABLE_NAME || 'platform-admin',
    TENANT_PUBLIC_TABLE: process.env.TENANT_PUBLIC_DYNAMO_DB || 'TENANT_PUBLIC',
    REGION: process.env.AWS_REGION || 'us-east-1'
  },
  
  // Tenant Configuration
  TENANT: {
    SUBSCRIPTION_TIERS: {
      PUBLIC: 'public',
      PRIVATE: 'private'
    }
  }
};