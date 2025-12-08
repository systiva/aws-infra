const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for deleting tenant DynamoDB table/entry based on subscription tier
 * 
 * ARCHITECTURE:
 * 1. Cross-account role assumption: Required to delete DynamoDB table/entry in tenant account
 * 2. Admin account DynamoDB: Used to update tenant registry status (no cross-account needed)
 * 
 * DELETION LOGIC:
 * - Public tenants: Delete tenant entry from TENANT_PUBLIC table (immediate)
 * - Private tenants: Delete entire CloudFormation stack containing DynamoDB table (requires polling)
 * 
 * Expected input from Step Functions:
 * {
 *   "operation": "DELETE",
 *   "tenantId": "tenant-12345", 
 *   "tenantName": "company-xyz",
 *   "subscriptionTier": "public" | "private",
 *   "tenantAccountId": "949642303066",
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
  if (!config.DYNAMODB.TENANT_PUBLIC_TABLE) {
    const error = new Error('Missing required environment variable: TENANT_PUBLIC_DYNAMO_DB');
    logger.error({ error: error.message }, 'Configuration validation failed');
    throw error;
  }

  // Log the raw event structure for debugging
  logger.debug({
    rawEvent: event,
    eventStructure: {
      hasNestedTenant: !!event.tenant,
      hasFlatTenantId: !!event.tenantId,
      hasStackId: !!event.stackId,
      subscriptionTier: event.subscriptionTier,
      operation: event.operation
    }
  }, 'Delete Infrastructure Worker - Analyzing input structure');

  // Initialize services
  const crossAccountService = new CrossAccountService();
  const adminDynamoDBService = new DynamoDBService(); // For admin account tenant registry

  try {
    // Extract and validate input - handle both nested and flat structures
    let tenant, infrastructure, metadata;
    
    if (event.tenant) {
      // Nested structure
      ({ tenant, infrastructure, metadata } = event);
    } else {
      // Flat structure from admin-portal-be Step Functions (current format)
      tenant = {
        id: event.tenantId,
        name: event.tenantName || `tenant-${event.tenantId}`, // Default if not provided
        subscriptionTier: event.subscriptionTier,
        email: event.email || `${event.tenantId}@tenant.local` // Default if not provided
      };
      infrastructure = {
        targetAccountId: event.tenantAccountId,
        stackId: event.stackId || event.infrastructure?.stackId, // Handle stackId for private tenants (direct from event)
        stackName: event.infrastructure?.stackName || event.tenantTableName,
        status: event.infrastructure?.status || 'UNKNOWN'
      };
      metadata = {
        requestId: context.awsRequestId,
        timestamp: event.deletedOn || new Date().toISOString(),
        initiatedBy: event.deletedBy || 'admin-portal',
        attempts: event.attempts || 0
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

    // Additional validation and stackId handling for private tenants
    if (tenant.subscriptionTier === 'private') {
      if (!infrastructure.stackId) {
        // Generate expected stack name if not provided
        infrastructure.stackId = `tenant-${tenant.id}-dynamodb`;
        logger.info({
          tenantId: tenant.id,
          generatedStackId: infrastructure.stackId
        }, 'Generated stackId for private tenant (not provided in input)');
      }
    }

    logger.info({
      tenantId: tenant.id,
      tenantName: tenant.name,
      subscriptionTier: tenant.subscriptionTier,
      targetAccountId: infrastructure.targetAccountId,
      requestId: metadata?.requestId
    }, 'Processing tenant DynamoDB deletion request');

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

    // Step 3: Delete DynamoDB table/entry based on subscription tier IN TENANT ACCOUNT
    if (tenant.subscriptionTier === 'public') {
      logger.info({ tenantId: tenant.id }, 'Step 3: Deleting tenant entry from public shared table (in tenant account)');
      
      result = await tenantDynamoDBService.deleteTenantEntryFromPublicTable({
        tenantId: tenant.id,
        tenantName: tenant.name,
        email: tenant.email,
        tenantAccountId: infrastructure.targetAccountId,
        deletedBy: metadata.initiatedBy,
        deletedOn: metadata.timestamp
      });
      
    } else if (tenant.subscriptionTier === 'private') {
      logger.info({ tenantId: tenant.id, stackId: infrastructure.stackId }, 'Step 3: Deleting dedicated DynamoDB table via CloudFormation (in tenant account)');
      
      result = await tenantDynamoDBService.deleteTenantDynamoDBTable({
        tenantId: tenant.id,
        tenantName: tenant.name,
        email: tenant.email,
        tenantAccountId: infrastructure.targetAccountId,
        stackId: infrastructure.stackId, // Pass the stackId from the infrastructure object
        deletedBy: metadata.initiatedBy,
        deletedOn: metadata.timestamp
      });
      
    } else {
      throw new Error(`Unsupported subscription tier: ${tenant.subscriptionTier}. Must be 'public' or 'private'`);
    }

    // Step 4: Update tenant registry status in admin account
    logger.info({ tenantId: tenant.id }, 'Step 4: Updating tenant registry in admin account');
    await adminDynamoDBService.updateTenantInfrastructure(tenant.id, {
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
        stackId: result.stackId || null, // Include stackId for delete polling (null for public tenants)
        stackName: result.tableName,
        status: result.success ? 'DELETE_COMPLETE' : 'DELETE_FAILED'
      },
      result: {
        success: result.success,
        operation: result.operation,
        tenantId: result.tenantId || tenant.id,
        tableName: result.tableName,
        stackId: result.stackId || null, // Include stackId in result as well (null for public tenants)
        subscriptionTier: tenant.subscriptionTier,
        deletedAt: result.deletedAt,
        executionTime: Date.now() - startTime
      }
    };

    logger.info({
      tenantId: tenant.id,
      subscriptionTier: tenant.subscriptionTier,
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
        operation: 'DELETE_TENANT_INFRASTRUCTURE',
        error: error.message,
        executionTime: Date.now() - startTime
      }
    };

    throw new Error(JSON.stringify(errorResponse));
  }
};