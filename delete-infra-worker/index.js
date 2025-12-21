const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for deleting account DynamoDB table/entry based on subscription tier
 * 
 * ARCHITECTURE:
 * 1. Cross-account role assumption: Required to delete DynamoDB table/entry in account account
 * 2. Admin account DynamoDB: Used to update account registry status (no cross-account needed)
 * 
 * DELETION LOGIC:
 * - Public accounts: Delete account entry from ACCOUNT_PUBLIC table (immediate)
 * - Private accounts: Delete entire CloudFormation stack containing DynamoDB table (requires polling)
 * 
 * Expected input from Step Functions:
 * {
 *   "operation": "DELETE",
 *   "accountId": "account-12345", 
 *   "accountName": "company-xyz",
 *   "subscriptionTier": "public" | "private",
 *   "accountAccountId": "949642303066",
 *   "email": "user@company.com",
 *   "deletedBy": "admin",
 *   "deletedOn": "2025-09-28T..."
 * }
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  logger.info({
    event,
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion
  }, 'Delete Infrastructure Worker - Lambda invoked');

  // Validate required environment variables
  if (!config.DYNAMODB.ACCOUNT_PUBLIC_TABLE) {
    const error = new Error('Missing required environment variable: ACCOUNT_PUBLIC_DYNAMO_DB');
    logger.error({ error: error.message }, 'Configuration validation failed');
    throw error;
  }

  // Log the raw event structure for debugging
  logger.debug({
    rawEvent: event,
    eventStructure: {
      hasNestedAccount: !!event.account,
      hasFlatAccountId: !!event.accountId,
      hasStackId: !!event.stackId,
      subscriptionTier: event.subscriptionTier,
      operation: event.operation
    }
  }, 'Delete Infrastructure Worker - Analyzing input structure');

  // Initialize services
  const crossAccountService = new CrossAccountService();
  const adminDynamoDBService = new DynamoDBService(); // For admin account account registry

  try {
    // Extract and validate input - handle both nested and flat structures
    let account, infrastructure, metadata;
    
    if (event.account) {
      // Nested structure
      ({ account, infrastructure, metadata } = event);
    } else {
      // Flat structure from admin-portal-be Step Functions (current format)
      account = {
        id: event.accountId,
        name: event.accountName || `account-${event.accountId}`, // Default if not provided
        subscriptionTier: event.subscriptionTier,
        email: event.email || `${event.accountId}@account.local` // Default if not provided
      };
      infrastructure = {
        targetAccountId: event.accountAccountId,
        stackId: event.stackId || event.infrastructure?.stackId, // Handle stackId for private accounts (direct from event)
        stackName: event.infrastructure?.stackName || event.accountTableName,
        status: event.infrastructure?.status || 'UNKNOWN'
      };
      metadata = {
        requestId: context.awsRequestId,
        timestamp: event.deletedOn || new Date().toISOString(),
        initiatedBy: event.deletedBy || 'admin-portal',
        attempts: event.attempts || 0
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

    // Additional validation and stackId handling for private accounts
    if (account.subscriptionTier === 'private') {
      if (!infrastructure.stackId) {
        // Generate expected stack name if not provided
        infrastructure.stackId = `account-${account.id}-dynamodb`;
        logger.info({
          accountId: account.id,
          generatedStackId: infrastructure.stackId
        }, 'Generated stackId for private account (not provided in input)');
      }
    }

    logger.info({
      accountId: account.id,
      accountName: account.name,
      subscriptionTier: account.subscriptionTier,
      targetAccountId: infrastructure.targetAccountId,
      requestId: metadata?.requestId
    }, 'Processing account DynamoDB deletion request');

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

    // Step 3: Delete DynamoDB table/entry based on subscription tier IN ACCOUNT ACCOUNT
    if (account.subscriptionTier === 'public') {
      logger.info({ accountId: account.id }, 'Step 3: Deleting account entry from public shared table (in account account)');
      
      result = await accountDynamoDBService.deleteAccountEntryFromPublicTable({
        accountId: account.id,
        accountName: account.name,
        email: account.email,
        accountAccountId: infrastructure.targetAccountId,
        deletedBy: metadata.initiatedBy,
        deletedOn: metadata.timestamp
      });
      
    } else if (account.subscriptionTier === 'private') {
      logger.info({ accountId: account.id, stackId: infrastructure.stackId }, 'Step 3: Deleting dedicated DynamoDB table via CloudFormation (in account account)');
      
      result = await accountDynamoDBService.deleteAccountDynamoDBTable({
        accountId: account.id,
        accountName: account.name,
        email: account.email,
        accountAccountId: infrastructure.targetAccountId,
        stackId: infrastructure.stackId, // Pass the stackId from the infrastructure object
        deletedBy: metadata.initiatedBy,
        deletedOn: metadata.timestamp
      });
      
    } else {
      throw new Error(`Unsupported subscription tier: ${account.subscriptionTier}. Must be 'public' or 'private'`);
    }

    // Step 4: Update account registry status in admin account
    logger.info({ accountId: account.id }, 'Step 4: Updating account registry in admin account');
    await adminDynamoDBService.updateAccountInfrastructure(account.id, {
      status: result.success ? 'DELETE_COMPLETE' : 'DELETE_FAILED',
      stackName: result.tableName,
      stackId: result.stackId || null,
      deletedAt: result.deletedAt || new Date().toISOString()
    });

    // Prepare response for Step Functions
    const response = {
      ...event,
      infrastructure: {
        ...event.infrastructure,
        stackId: result.stackId || null, // Include stackId for delete polling (null for public accounts)
        stackName: result.tableName,
        status: result.success ? 'DELETE_COMPLETE' : 'DELETE_FAILED'
      },
      result: {
        success: result.success,
        operation: result.operation,
        accountId: result.accountId || account.id,
        tableName: result.tableName,
        stackId: result.stackId || null, // Include stackId in result as well (null for public accounts)
        subscriptionTier: account.subscriptionTier,
        deletedAt: result.deletedAt,
        executionTime: Date.now() - startTime
      }
    };

    logger.info({
      accountId: account.id,
      subscriptionTier: account.subscriptionTier,
      tableName: result.tableName,
      success: result.success,
      executionTime: response.result.executionTime
    }, 'Delete Infrastructure Worker - Completed successfully');

    return response;

  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      event,
      executionTime: Date.now() - startTime
    }, 'Delete Infrastructure Worker - Failed');

    // Return error for Step Functions
    const errorResponse = {
      ...event,
      result: {
        success: false,
        operation: 'DELETE_ACCOUNT_INFRASTRUCTURE',
        error: error.message,
        executionTime: Date.now() - startTime
      }
    };

    throw new Error(JSON.stringify(errorResponse));
  }
};