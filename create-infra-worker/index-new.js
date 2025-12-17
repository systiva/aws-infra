const logger = require('./logger');
const config = require('./config');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for creating tenant DynamoDB table/entry based on subscription tier
 * This worker ONLY handles DynamoDB operations in admin account - no cross-account access needed
 * Expected input from Step Functions:
 * {
 *   "operation": "CREATE",
 *   "tenantId": "tenant-12345",
 *   "tenantName": "company-xyz",
 *   "subscriptionTier": "public" | "private",
 *   "tenantAccountId": "949642303066",
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
      tenantId,
      tenantName,
      subscriptionTier,
      tenantAccountId,
      email,
      createdBy,
      registeredOn
    } = event;

    // Validate required fields
    if (!tenantId) {
      throw new Error('Invalid input: tenantId is required');
    }

    if (!subscriptionTier) {
      throw new Error('Invalid input: subscriptionTier is required');
    }

    if (!['public', 'private'].includes(subscriptionTier)) {
      throw new Error('Invalid input: subscriptionTier must be "public" or "private"');
    }

    logger.info({
      tenantId,
      tenantName,
      subscriptionTier,
      operation
    }, 'Processing tenant DynamoDB creation request');

    let result;

    // Create tenant data object
    const tenantData = {
      tenantId,
      tenantName,
      subscriptionTier,
      tenantAccountId,
      email,
      createdBy,
      registeredOn
    };

    // Handle subscription tier logic - NO cross-account operations needed
    if (subscriptionTier === 'public') {
      logger.info({ tenantId }, 'Creating entry in public shared table');
      result = await dynamoDBService.createTenantEntryInPublicTable(tenantData);
    } else {
      logger.info({ tenantId }, 'Creating dedicated DynamoDB table entry for private tenant');
      result = await dynamoDBService.createTenantDynamoDBTable(tenantData);
    }

    const executionTime = Date.now() - startTime;

    logger.info({
      tenantId,
      subscriptionTier,
      result: result.success,
      executionTime
    }, 'Tenant DynamoDB creation completed');

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
        operation: 'CREATE_DYNAMODB_TENANT',
        error: error.message,
        executionTime
      }
    };

    // For Step Functions, we need to throw the error with the event data
    throw new Error(JSON.stringify(errorResponse));
  }
};