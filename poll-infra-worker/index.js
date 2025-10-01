const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const StackPollingService = require('./src/stack-polling-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for polling tenant infrastructure status
 * Expected input from Step Functions:
 * {
 *   "tenant": {
 *     "id": "tenant-12345",
 *     "name": "company-xyz",
 *     "region": "us-east-1"
 *   },
 *   "infrastructure": {
 *     "targetAccountId": "949642303066",
 *     "stackId": "arn:aws:cloudformation:us-east-1:949642303066:stack/tenant-infra-tenant-12345/...",
 *     "stackName": "tenant-infra-tenant-12345",
 *     "status": "CREATE_IN_PROGRESS"
 *   },
 *   "metadata": {
 *     "requestId": "req-123",
 *     "attempts": 1
 *   }
 * }
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  logger.info({
    event,
    requestId: context.awsRequestId,
    functionName: context.functionName,
    remainingTimeInMillis: context.getRemainingTimeInMillis()
  }, 'Poll Infrastructure Worker - Lambda invoked');

  // Initialize services
  const crossAccountService = new CrossAccountService();
  const dynamoDBService = new DynamoDBService();

  try {
    // Extract and validate input - flat structure from Step Functions
    const tenant = {
      id: event.tenantId,
      name: event.tenantName,
      subscriptionTier: event.subscriptionTier,
      email: event.email
    };
    
    const infrastructure = {
      stackId: event.infrastructure?.stackId || event.stackId,
      stackName: event.infrastructure?.stackName || event.tableName,
      targetAccountId: event.infrastructure?.targetAccountId || event.tenantAccountId,
      status: event.infrastructure?.status
    };
    
    const metadata = {
      requestId: context.awsRequestId,
      timestamp: event.registeredOn || event.deletedOn || new Date().toISOString(),
      initiatedBy: event.createdBy || event.deletedBy || 'admin-portal',
      attempts: event.metadata?.attempts || event.attempts || 0
    };
    
    if (!tenant || !tenant.id) {
      throw new Error('Invalid input: tenant ID is required');
    }

    if (!tenant.subscriptionTier) {
      throw new Error('Invalid input: tenant.subscriptionTier is required');
    }

    // Determine operation type from event data (operation is directly in flat structure)
    const operation = event.operation || 'CREATE'; // Default to CREATE if not specified
    
    logger.info({
      tenantId: tenant.id,
      operation,
      infrastructureStatus: infrastructure.status,
      hasInfrastructureObject: !!event.infrastructure
    }, 'Detected operation type from flat structure');

    // For public tenants, no CloudFormation polling needed - just return the result from create-infra/delete-infra
    if (tenant.subscriptionTier === 'public') {
      logger.info({
        tenantId: tenant.id,
        subscriptionTier: 'public',
        operation
      }, 'Public tenant detected - no CloudFormation polling needed');

      // For public tenants, use the actual status from the create-infra/delete-infra result
      const operationStatus = infrastructure.status || (operation === 'DELETE' ? 'DELETE_COMPLETE' : 'CREATE_COMPLETE');
      const operationMessage = infrastructure.statusReason || `Public tenant ${operation.toLowerCase()} operation completed`;
      const operationReason = operationMessage;
      
      const response = {
        ...event,
        status: 'COMPLETE', // Step Functions expects this at root level
        infrastructure: {
          ...infrastructure,
          status: operationStatus,
          statusReason: operationMessage,
          completedAt: new Date().toISOString()
        },
        metadata: {
          ...metadata,
          attempts: 1 // No actual polling needed
        },
        result: {
          success: true,
          operation: 'POLL_INFRASTRUCTURE',
          status: 'COMPLETED',
          message: `Public tenant infrastructure ${operation === 'DELETE' ? 'deleted' : 'ready'} (no CloudFormation stack needed)`,
          executionTime: Date.now() - startTime
        }
      };

      // Update tenant registry based on operation type
      await dynamoDBService.updateTenantInfrastructureStatus(tenant.id, {
        status: operationStatus,
        isComplete: true,
        isFailed: false,
        statusReason: operationReason
      }, operation);

      logger.info({
        tenantId: tenant.id,
        subscriptionTier: 'public',
        operation,
        finalStatus: operationStatus
      }, 'Poll Infrastructure Worker - Public tenant completed immediately');

      return response;
    }

    // For private tenants, continue with CloudFormation polling
    logger.info({
      tenantId: tenant.id,
      subscriptionTier: 'private',
      operation
    }, 'Private tenant detected - proceeding with CloudFormation polling');

    // For private tenants, stackId is required for CloudFormation polling
    const attempts = (metadata?.attempts || 0) + 1;
    const tenantId = tenant.id;
    const stackId = infrastructure.stackId;

    if (!stackId) {
      throw new Error('Invalid input: stackId is required for private tenant CloudFormation polling');
    }

    logger.info({
      tenantId,
      stackId,
      attempts,
      maxAttempts: config.CLOUDFORMATION.MAX_POLL_ATTEMPTS
    }, 'Processing infrastructure status polling request');

    // Record polling attempt
    await dynamoDBService.recordPollingAttempt(tenantId, attempts);

    // Step 1: Assume cross-account role
    logger.info({ tenantId, attempts }, 'Step 1: Assuming cross-account role');
    const credentials = await crossAccountService.assumeTenantRole(
      infrastructure.targetAccountId,
      tenantId
    );

    // Step 2: Create CloudFormation client
    logger.info({ tenantId, attempts }, 'Step 2: Creating CloudFormation client');
    const cloudFormationClient = crossAccountService.createCloudFormationClient(
      credentials,
      tenant.region
    );
    const stackPollingService = new StackPollingService(cloudFormationClient);

    // Step 3: Poll stack status
    logger.info({ tenantId, stackId, attempts }, 'Step 3: Polling stack status');
    const stackData = await stackPollingService.pollStackStatus(stackId, tenantId);

    // Step 4: Check polling decision
    const pollingDecision = stackPollingService.shouldContinuePolling(stackData.status, attempts);
    
    logger.info({
      tenantId,
      stackId,
      stackStatus: stackData.status,
      pollingDecision
    }, 'Step 4: Evaluated polling decision');

    // Step 5: Update tenant registry
    logger.info({ tenantId, stackStatus: stackData.status }, 'Step 5: Updating tenant registry');
    await dynamoDBService.updateTenantInfrastructureStatus(tenantId, stackData, operation);

    // Prepare response based on polling decision
    if (pollingDecision.shouldContinue) {
      // Stack still in progress - will retry
      const response = {
        ...event,
        status: 'IN_PROGRESS', // Step Functions expects this at root level
        infrastructure: {
          ...infrastructure,
          status: stackData.status,
          statusReason: stackData.statusReason,
          lastPolledAt: new Date().toISOString()
        },
        metadata: {
          ...metadata,
          attempts: attempts,
          pollingDecision
        },
        result: {
          success: true,
          operation: 'POLL_INFRASTRUCTURE',
          status: 'IN_PROGRESS',
          executionTime: Date.now() - startTime
        }
      };

      logger.info({
        tenantId,
        stackId,
        attempts,
        nextPollIn: `${config.CLOUDFORMATION.POLL_INTERVAL_SECONDS}s`
      }, 'Poll Infrastructure Worker - Will continue polling');

      // Return response with IN_PROGRESS status for Step Functions to handle retry
      return response;

    } else if (pollingDecision.finalStatus === 'COMPLETE') {
      // Stack completed successfully
      const response = {
        ...event,
        status: 'COMPLETE', // Step Functions expects this at root level
        infrastructure: {
          ...infrastructure,
          status: stackData.status,
          statusReason: stackData.statusReason,
          outputs: stackData.outputs,
          completedAt: new Date().toISOString()
        },
        metadata: {
          ...metadata,
          attempts: attempts,
          pollingDecision
        },
        result: {
          success: true,
          operation: 'POLL_INFRASTRUCTURE',
          status: 'COMPLETED',
          outputs: stackData.outputs,
          executionTime: Date.now() - startTime
        }
      };

      logger.info({
        tenantId,
        stackId,
        attempts,
        outputs: Object.keys(stackData.outputs)
      }, 'Poll Infrastructure Worker - Stack completed successfully');

      return response;

    } else if (pollingDecision.finalStatus === 'TIMEOUT') {
      // Polling timeout reached
      await dynamoDBService.recordPollingTimeout(tenantId, attempts);

      const response = {
        ...event,
        status: 'FAILED', // Step Functions expects this at root level
        infrastructure: {
          ...infrastructure,
          status: 'TIMEOUT',
          statusReason: 'Polling timeout reached'
        },
        metadata: {
          ...metadata,
          attempts: attempts,
          pollingDecision
        },
        result: {
          success: false,
          operation: 'POLL_INFRASTRUCTURE',
          status: 'TIMEOUT',
          error: `Polling timeout after ${attempts} attempts`,
          executionTime: Date.now() - startTime
        }
      };

      logger.warn({
        tenantId,
        stackId,
        attempts,
        maxAttempts: config.CLOUDFORMATION.MAX_POLL_ATTEMPTS
      }, 'Poll Infrastructure Worker - Polling timeout reached');

      throw new Error(JSON.stringify(response));

    } else {
      // Stack failed or unknown status
      const stackEvents = await stackPollingService.getStackEvents(stackId, tenantId);
      
      const response = {
        ...event,
        status: 'FAILED', // Step Functions expects this at root level
        infrastructure: {
          ...infrastructure,
          status: stackData.status,
          statusReason: stackData.statusReason,
          events: stackEvents.slice(0, 5) // Include last 5 events
        },
        metadata: {
          ...metadata,
          attempts: attempts,
          pollingDecision
        },
        result: {
          success: false,
          operation: 'POLL_INFRASTRUCTURE',
          status: 'FAILED',
          error: `Stack failed with status: ${stackData.status}`,
          executionTime: Date.now() - startTime
        }
      };

      logger.error({
        tenantId,
        stackId,
        stackStatus: stackData.status,
        statusReason: stackData.statusReason,
        attempts
      }, 'Poll Infrastructure Worker - Stack failed');

      throw new Error(JSON.stringify(response));
    }

  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      event,
      executionTime: Date.now() - startTime
    }, 'Poll Infrastructure Worker - Failed');

    // Return error response for Step Functions
    const errorResponse = {
      ...event,
      status: 'FAILED', // Step Functions expects this at root level
      result: {
        success: false,
        operation: 'POLL_INFRASTRUCTURE',
        error: error.message,
        executionTime: Date.now() - startTime
      }
    };

    throw new Error(JSON.stringify(errorResponse));
  }
};

// Export for local testing
if (require.main === module) {
  const testEventPublic = {
    operation: 'CREATE',
    tenantId: 'tenant-test-123',
    tenantName: 'test-company-public',
    subscriptionTier: 'public',
    email: 'test@example.com',
    createdBy: 'admin',
    registeredOn: new Date().toISOString(),
    infrastructure: {
      targetAccountId: process.env.TENANT_ACCOUNT_ID || '949642303066',
      stackName: 'TENANT_PUBLIC',
      status: 'CREATE_COMPLETE'
    }
  };

  const testEventPrivate = {
    operation: 'CREATE',
    tenantId: 'tenant-test-456',
    tenantName: 'test-company-private',
    subscriptionTier: 'private',
    email: 'test-private@example.com',
    createdBy: 'admin',
    registeredOn: new Date().toISOString(),
    infrastructure: {
      targetAccountId: process.env.TENANT_ACCOUNT_ID || '949642303066',
      stackId: 'arn:aws:cloudformation:us-east-1:949642303066:stack/tenant-test-456-dynamodb/12345678-1234-1234-1234-123456789012',
      stackName: 'tenant-test-456-dynamodb',
      status: 'CREATE_IN_PROGRESS'
    }
  };

  const testContext = {
    awsRequestId: 'local-test-request',
    functionName: 'poll-infra-worker-local',
    functionVersion: '1.0',
    getRemainingTimeInMillis: () => 300000 // 5 minutes
  };

  // Test public tenant (should complete immediately)
  console.log('Testing PUBLIC tenant polling...');
  exports.handler(testEventPublic, testContext)
    .then(result => {
      console.log('Public tenant success:', JSON.stringify(result, null, 2));
      
      // Test private tenant (should poll CloudFormation)
      console.log('\nTesting PRIVATE tenant polling...');
      return exports.handler(testEventPrivate, testContext);
    })
    .then(result => {
      console.log('Private tenant success:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      try {
        const errorData = JSON.parse(error.message);
        console.log('Error Data:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Raw Error:', error.message);
      }
    });
}