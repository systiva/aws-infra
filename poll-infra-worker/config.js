module.exports = {
  // AWS Configuration
  AWS: {
    REGION: process.env.AWS_REGION || 'us-east-1',
    ADMIN_ACCOUNT_ID: process.env.ADMIN_ACCOUNT_ID || '583122682394',
    TENANT_ACCOUNT_ID: process.env.TENANT_ACCOUNT_ID || '949642303066'
  },
  
  // Cross-account IAM Configuration
  CROSS_ACCOUNT: {
    ROLE_NAME: process.env.TENANT_ACCOUNT_ROLE_NAME || 'CrossAccountTenantRole',
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
    TENANT_REGISTRY_TABLE: process.env.TENANT_REGISTRY_TABLE_NAME || 'platform-admin',
    REGION: process.env.AWS_REGION || 'us-east-1'
  }
};