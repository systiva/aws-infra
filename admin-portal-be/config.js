// Validate required environment variables
const requiredEnvVars = [
  'ADMIN_ACCOUNT_ID',
  'TENANT_ACCOUNT_ID',
  'AWS_REGION',
  'CROSS_ACCOUNT_ROLE_NAME',
  'CREATE_TENANT_STATE_MACHINE_ARN',
  'DELETE_TENANT_STATE_MACHINE_ARN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

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
    ADMIN_ACCOUNT_ID: process.env.ADMIN_ACCOUNT_ID,
    TENANT_ACCOUNT_ID: process.env.TENANT_ACCOUNT_ID,
    AWS_REGION: process.env.AWS_REGION,
    CROSS_ACCOUNT_ROLE_NAME: process.env.CROSS_ACCOUNT_ROLE_NAME
  },
  
  // Step Functions configuration for tenant lifecycle management
  STEP_FUNCTIONS: {
    REGION: process.env.AWS_REGION,
    CREATE_TENANT_STATE_MACHINE_ARN: process.env.CREATE_TENANT_STATE_MACHINE_ARN,
    DELETE_TENANT_STATE_MACHINE_ARN: process.env.DELETE_TENANT_STATE_MACHINE_ARN,
    EXECUTION_TIMEOUT: 900 // 15 minutes
  },
  
  // AWS Configuration
  AWS_REGION: process.env.AWS_REGION
};
