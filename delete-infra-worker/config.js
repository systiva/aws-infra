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
    SESSION_NAME: 'delete-dynamodb-worker-session',
    ASSUME_ROLE_DURATION: 3600 // 1 hour
  },
  
  // DynamoDB Configuration
  DYNAMODB: {
    TENANT_REGISTRY_TABLE: process.env.TENANT_REGISTRY_TABLE_NAME || 'platform-admin',
    TENANT_PUBLIC_TABLE: process.env.TENANT_PUBLIC_DYNAMO_DB,
    REGION: process.env.AWS_REGION || 'us-east-1'
  }
};