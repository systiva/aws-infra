const logger = require('./logger');
const config = require('./config');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for creating account DynamoDB table/entry based on subscription tier
 * This worker ONLY handles DynamoDB operations in admin account - no cross-account access needed
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

  // Initialize DynamoDB service only
  const dynamoDBService = new DynamoDBService();

  try {
    // Extract and validate input - expecting flat structure from Step Functions
    const {
      operation,
      accountId,
      accountName,
      subscriptionTier,
      accountAccountId,
      email,
      createdBy,
      registeredOn
    } = event;

    // Validate required fields
    if (!accountId) {
      throw new Error('Invalid input: accountId is required');
    }

    if (!subscriptionTier) {
      throw new Error('Invalid input: subscriptionTier is required');
    }

    if (!['public', 'private'].includes(subscriptionTier)) {
      throw new Error('Invalid input: subscriptionTier must be "public" or "private"');
    }

    logger.info({
      accountId,
      accountName,
      subscriptionTier,
      operation
    }, 'Processing account DynamoDB creation request');

    let result;

    // Create account data object
    const accountData = {
      accountId,
      accountName,
      subscriptionTier,
      accountAccountId,
      email,
      createdBy,
      registeredOn
    };

    // Handle subscription tier logic - NO cross-account operations needed
    if (subscriptionTier === 'public') {
      logger.info({ accountId }, 'Creating entry in public shared table');
      result = await dynamoDBService.createAccountEntryInPublicTable(accountData);
    } else {
      logger.info({ accountId }, 'Creating dedicated DynamoDB table entry for private account');
      result = await dynamoDBService.createAccountDynamoDBTable(accountData);
    }

    const executionTime = Date.now() - startTime;

    logger.info({
      accountId,
      subscriptionTier,
      result: result.success,
      executionTime
    }, 'Account DynamoDB creation completed');

    // Return result for Step Functions
    return {
      ...event,
      status: result.success ? 'COMPLETE' : 'FAILED',
      result: {
        ...result,
        executionTime
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error({
      error: error.message,
      stack: error.stack,
      event,
      executionTime
    }, 'Create DynamoDB Worker - Failed');

    // Return error for Step Functions
    const errorResponse = {
      ...event,
      status: 'FAILED',
      result: {
        success: false,
        operation: 'CREATE_DYNAMODB_ACCOUNT',
        error: error.message,
        executionTime
      }
    };

    // For Step Functions, we need to throw the error with the event data
    throw new Error(JSON.stringify(errorResponse));
  }
};