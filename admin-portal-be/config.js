module.exports = {
  DYNAMO_DB_DEV: {
    ACCESS_KEY: 'test',
    ACCESS_SECRET: 'ttest',
  },
  DYNAMO_DB_UAT: {
    ACCESS_KEY: 'test',
    ACCESS_SECRET: 'test',
  },
  DYNAMO_DB_QA: {
    ACCESS_KEY: 'test',
    ACCESS_SECRET: 'test',
  },
  // Cross-account configuration for tenant provisioning
  CROSS_ACCOUNT: {
    ADMIN_ACCOUNT_ID: process.env.ADMIN_ACCOUNT_ID || '583122682394',
    TENANT_ACCOUNT_ID: process.env.TENANT_ACCOUNT_ID || '560261045252',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    CROSS_ACCOUNT_ROLE_NAME: process.env.CROSS_ACCOUNT_ROLE_NAME || 'CrossAccountTenantRole'
  },
  
  // Step Functions configuration for tenant lifecycle management
  STEP_FUNCTIONS: {
    REGION: process.env.AWS_REGION || 'us-east-1',
    CREATE_TENANT_STATE_MACHINE_ARN: process.env.CREATE_TENANT_STATE_MACHINE_ARN,
    DELETE_TENANT_STATE_MACHINE_ARN: process.env.DELETE_TENANT_STATE_MACHINE_ARN,
    EXECUTION_TIMEOUT: 900 // 15 minutes
  },
  
  // AWS Configuration
  AWS_REGION: process.env.AWS_REGION || 'us-east-1'
};
