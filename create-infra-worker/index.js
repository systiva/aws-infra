const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for creating tenant DynamoDB table/entry based on subscription tier
 * 
 * ARCHITECTURE:
 * 1. Cross-account role assumption: Required to create DynamoDB table/entry in tenant account
 * 2. Admin account DynamoDB: Used to update tenant registry status (no cross-account needed)
 * 
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

  // Validate required environment variables
  if (!config.DYNAMODB.TENANT_PUBLIC_TABLE) {
    const error = new Error('Missing required environment variable: TENANT_PUBLIC_DYNAMO_DB');
    logger.error({ error: error.message }, 'Configuration validation failed');
    throw error;
  }

  // Initialize services
  const crossAccountService = new CrossAccountService();
  const adminDynamoDBService = new DynamoDBService(); // For admin account tenant registry
  const dynamoDBService = new DynamoDBService();

  try {
    // Extract and validate input - handle both nested and flat structures
    let tenant, infrastructure, metadata;
    
    if (event.tenant) {
      // Nested structure
      ({ tenant, infrastructure, metadata } = event);
    } else {
      // Flat structure from admin-portal-be
      tenant = {
        id: event.tenantId,
        name: event.tenantName,
        subscriptionTier: event.subscriptionTier,
        email: event.email
      };
      infrastructure = {
        targetAccountId: event.tenantAccountId
      };
      metadata = {
        requestId: context.awsRequestId,
        timestamp: event.registeredOn || new Date().toISOString(),
        initiatedBy: event.createdBy || 'admin-portal'
      };
    }
    
    if (!tenant || !tenant.id) {
      throw new Error('Invalid input: tenant ID is required');
    }

    if (!tenant.subscriptionTier) {
      throw new Error('Invalid input: tenant.subscriptionTier is required');
    }

    if (!['public', 'private'].includes(tenant.subscriptionTier)) {
      throw new Error('Invalid input: tenant.subscriptionTier must be "public" or "private"');
    }

    if (!infrastructure || !infrastructure.targetAccountId) {
      throw new Error('Invalid input: infrastructure.targetAccountId is required');
    }

    logger.info({
      tenantId: tenant.id,
      tenantName: tenant.name,
      subscriptionTier: tenant.subscriptionTier,
      targetAccountId: infrastructure.targetAccountId,
      requestId: metadata?.requestId
    }, 'Processing tenant DynamoDB creation request');

    // Step 1: Assume cross-account role to access tenant account
    logger.info({ tenantId: tenant.id }, 'Step 1: Assuming cross-account role');
    const credentials = await crossAccountService.assumeTenantRole(
      infrastructure.targetAccountId,
      tenant.id
    );

    // Step 2: Create DynamoDB service for tenant account operations
    logger.info({ tenantId: tenant.id }, 'Step 2: Creating tenant account DynamoDB service');
    const tenantDynamoDBService = new DynamoDBService(credentials, infrastructure.targetAccountId);

    let result;

    // Step 3: Create DynamoDB table/entry based on subscription tier IN TENANT ACCOUNT
    if (tenant.subscriptionTier === 'public') {
      logger.info({ tenantId: tenant.id }, 'Step 3: Creating tenant entry in public shared table (in tenant account)');
      
      result = await tenantDynamoDBService.createTenantEntryInPublicTable({
        tenantId: tenant.id,
        tenantName: tenant.name,
        email: tenant.email,
        tenantAccountId: infrastructure.targetAccountId,
        createdBy: metadata.initiatedBy,
        registeredOn: metadata.timestamp
      });
      
    } else if (tenant.subscriptionTier === 'private') {
      logger.info({ tenantId: tenant.id }, 'Step 3: Creating dedicated DynamoDB table (in tenant account)');
      
      result = await tenantDynamoDBService.createTenantDynamoDBTable({
        tenantId: tenant.id,
        tenantName: tenant.name,
        email: tenant.email,
        tenantAccountId: infrastructure.targetAccountId,
        createdBy: metadata.initiatedBy,
        registeredOn: metadata.timestamp
      });
      
    } else {
      throw new Error(`Unsupported subscription tier: ${tenant.subscriptionTier}. Must be 'public' or 'private'`);
    }

    // Step 4: Update tenant registry status in admin account
    logger.info({ tenantId: tenant.id }, 'Step 4: Updating tenant registry in admin account');
    await adminDynamoDBService.updateTenantInfrastructure(tenant.id, {
      status: result.success ? 'CREATE_COMPLETE' : 'CREATE_FAILED',
      stackName: result.tableName,
      stackId: result.stackId || null, // null for public tenants
      createdAt: result.createdAt || new Date().toISOString()
    });

    // Prepare response for Step Functions
    const response = {
      ...event,
      infrastructure: {
        ...event.infrastructure,
        stackId: result.stackId || null, // Include stackId for poll-infra-worker (null for public tenants)
        stackName: result.tableName,
        status: result.success ? 'CREATE_COMPLETE' : 'CREATE_FAILED'
      },
      result: {
        success: result.success,
        operation: result.operation,
        tenantId: result.tenantId || tenant.id,
        tableName: result.tableName,
        stackId: result.stackId || null, // Include stackId in result as well (null for public tenants)
        subscriptionTier: tenant.subscriptionTier,
        createdAt: result.createdAt,
        executionTime: Date.now() - startTime
      }
    };

    logger.info({
      tenantId: tenant.id,
      subscriptionTier: tenant.subscriptionTier,
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
        operation: 'CREATE_DYNAMODB_TENANT',
        error: error.message,
        executionTime: Date.now() - startTime
      }
    };

    throw new Error(JSON.stringify(errorResponse));
  }
};