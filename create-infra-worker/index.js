const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for creating account DynamoDB table/entry based on subscription tier
 * 
 * ARCHITECTURE:
 * 1. Cross-account role assumption: Required to create DynamoDB table/entry in account account
 * 2. Admin account DynamoDB: Used to update account registry status (no cross-account needed)
 * 
 * Expected input from Step Functions:
 * {
 *   "operation": "CREATE",
 *   "accountId": "account-12345", 
 *   "accountName": "company-xyz",
 *   "subscriptionTier": "public" | "private",
 *   "accountAccountId": "949642303066",
 *   "email": "user@company.com",
 *   "createdBy": "admin",
 *   "registeredOn": "2025-09-28T..."
 * }
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  logger.info({
    event,
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion
  }, 'Create Infrastructure Worker - Lambda invoked');

  // Validate required environment variables
  if (!config.DYNAMODB.ACCOUNT_PUBLIC_TABLE) {
    const error = new Error('Missing required environment variable: ACCOUNT_PUBLIC_DYNAMO_DB');
    logger.error({ error: error.message }, 'Configuration validation failed');
    throw error;
  }

  // Initialize services
  const crossAccountService = new CrossAccountService();
  const adminDynamoDBService = new DynamoDBService(); // For admin account account registry
  const dynamoDBService = new DynamoDBService();

  try {
    // Extract and validate input - handle both nested and flat structures
    let account, infrastructure, metadata;
    
    if (event.account) {
      // Nested structure
      ({ account, infrastructure, metadata } = event);
    } else {
      // Flat structure from admin-portal-be
      account = {
        id: event.accountId,
        name: event.accountName,
        subscriptionTier: event.subscriptionTier,
        email: event.email
      };
      infrastructure = {
        targetAccountId: event.accountAccountId
      };
      metadata = {
        requestId: context.awsRequestId,
        timestamp: event.registeredOn || new Date().toISOString(),
        initiatedBy: event.createdBy || 'admin-portal'
      };
    }
    
    if (!account || !account.id) {
      throw new Error('Invalid input: account ID is required');
    }

    if (!account.subscriptionTier) {
      throw new Error('Invalid input: account.subscriptionTier is required');
    }

    if (!['public', 'private'].includes(account.subscriptionTier)) {
      throw new Error('Invalid input: account.subscriptionTier must be "public" or "private"');
    }

    if (!infrastructure || !infrastructure.targetAccountId) {
      throw new Error('Invalid input: infrastructure.targetAccountId is required');
    }

    logger.info({
      accountId: account.id,
      accountName: account.name,
      subscriptionTier: account.subscriptionTier,
      targetAccountId: infrastructure.targetAccountId,
      requestId: metadata?.requestId
    }, 'Processing account DynamoDB creation request');

    // Step 1: Assume cross-account role to access account account
    logger.info({ accountId: account.id }, 'Step 1: Assuming cross-account role');
    const credentials = await crossAccountService.assumeAccountRole(
      infrastructure.targetAccountId,
      account.id
    );

    // Step 2: Create DynamoDB service for account account operations
    logger.info({ accountId: account.id }, 'Step 2: Creating account account DynamoDB service');
    const accountDynamoDBService = new DynamoDBService(credentials, infrastructure.targetAccountId);

    let result;

    // Step 3: Create DynamoDB table/entry based on subscription tier IN ACCOUNT ACCOUNT
    if (account.subscriptionTier === 'public') {
      logger.info({ accountId: account.id }, 'Step 3: Creating account entry in public shared table (in account account)');
      
      result = await accountDynamoDBService.createAccountEntryInPublicTable({
        accountId: account.id,
        accountName: account.name,
        email: account.email,
        accountAccountId: infrastructure.targetAccountId,
        createdBy: metadata.initiatedBy,
        registeredOn: metadata.timestamp
      });
      
    } else if (account.subscriptionTier === 'private') {
      logger.info({ accountId: account.id }, 'Step 3: Creating dedicated DynamoDB table (in account account)');
      
      result = await accountDynamoDBService.createAccountDynamoDBTable({
        accountId: account.id,
        accountName: account.name,
        email: account.email,
        accountAccountId: infrastructure.targetAccountId,
        createdBy: metadata.initiatedBy,
        registeredOn: metadata.timestamp
      });
      
    } else {
      throw new Error(`Unsupported subscription tier: ${account.subscriptionTier}. Must be 'public' or 'private'`);
    }

    // Step 4: Update account registry status in admin account
    logger.info({ accountId: account.id }, 'Step 4: Updating account registry in admin account');
    await adminDynamoDBService.updateAccountInfrastructure(account.id, {
      status: result.success ? 'CREATE_COMPLETE' : 'CREATE_FAILED',
      stackName: result.tableName,
      stackId: result.stackId || null, // null for public accounts
      createdAt: result.createdAt || new Date().toISOString()
    });

    // Prepare response for Step Functions
    const response = {
      ...event,
      infrastructure: {
        ...event.infrastructure,
        stackId: result.stackId || null, // Include stackId for poll-infra-worker (null for public accounts)
        stackName: result.tableName,
        status: result.success ? 'CREATE_COMPLETE' : 'CREATE_FAILED'
      },
      result: {
        success: result.success,
        operation: result.operation,
        accountId: result.accountId || account.id,
        tableName: result.tableName,
        stackId: result.stackId || null, // Include stackId in result as well (null for public accounts)
        subscriptionTier: account.subscriptionTier,
        createdAt: result.createdAt,
        executionTime: Date.now() - startTime
      }
    };

    logger.info({
      accountId: account.id,
      subscriptionTier: account.subscriptionTier,
      tableName: result.tableName,
      success: result.success,
      executionTime: response.result.executionTime
    }, 'Create DynamoDB Worker - Completed successfully');

    return response;

  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      event,
      executionTime: Date.now() - startTime
    }, 'Create DynamoDB Worker - Failed');

    // Return error for Step Functions
    const errorResponse = {
      ...event,
      result: {
        success: false,
        operation: 'CREATE_DYNAMODB_ACCOUNT',
        error: error.message,
        executionTime: Date.now() - startTime
      }
    };

    throw new Error(JSON.stringify(errorResponse));
  }
};