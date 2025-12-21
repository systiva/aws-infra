const logger = require('./logger');
const config = require('./config');
const CrossAccountService = require('./src/cross-account-service');
const StackPollingService = require('./src/stack-polling-service');
const DynamoDBService = require('./src/dynamodb-service');

/**
 * AWS Lambda handler for polling account infrastructure status
 * Expected input from Step Functions:
 * {
 *   "account": {
 *     "id": "account-12345",
 *     "name": "company-xyz",
 *     "region": "us-east-1"
 *   },
 *   "infrastructure": {
 *     "targetAccountId": "949642303066",
 *     "stackId": "arn:aws:cloudformation:us-east-1:949642303066:stack/account-infra-account-12345/...",
 *     "stackName": "account-infra-account-12345",
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
    const account = {
      id: event.accountId,
      name: event.accountName,
      subscriptionTier: event.subscriptionTier,
      email: event.email
    };
    
    const infrastructure = {
      stackId: event.infrastructure?.stackId || event.stackId,
      stackName: event.infrastructure?.stackName || event.tableName,
      targetAccountId: event.infrastructure?.targetAccountId || event.accountAccountId,
      status: event.infrastructure?.status
    };
    
    const metadata = {
      requestId: context.awsRequestId,
      timestamp: event.registeredOn || event.deletedOn || new Date().toISOString(),
      initiatedBy: event.createdBy || event.deletedBy || 'admin-portal',
      attempts: event.metadata?.attempts || event.attempts || 0
    };
    
    if (!account || !account.id) {
      throw new Error('Invalid input: account ID is required');
    }

    if (!account.subscriptionTier) {
      throw new Error('Invalid input: account.subscriptionTier is required');
    }

    // Determine operation type from event data (operation is directly in flat structure)
    const operation = event.operation || 'CREATE'; // Default to CREATE if not specified
    
    logger.info({
      accountId: account.id,
      operation,
      infrastructureStatus: infrastructure.status,
      hasInfrastructureObject: !!event.infrastructure
    }, 'Detected operation type from flat structure');

    // For public accounts, no CloudFormation polling needed - just return the result from create-infra/delete-infra
    if (account.subscriptionTier === 'public') {
      logger.info({
        accountId: account.id,
        subscriptionTier: 'public',
        operation
      }, 'Public account detected - no CloudFormation polling needed');

      // For public accounts, use the actual status from the create-infra/delete-infra result
      const operationStatus = infrastructure.status || (operation === 'DELETE' ? 'DELETE_COMPLETE' : 'CREATE_COMPLETE');
      const operationMessage = infrastructure.statusReason || `Public account ${operation.toLowerCase()} operation completed`;
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
          message: `Public account infrastructure ${operation === 'DELETE' ? 'deleted' : 'ready'} (no CloudFormation stack needed)`,
          executionTime: Date.now() - startTime
        }
      };

      // Update account registry based on operation type
      await dynamoDBService.updateAccountInfrastructureStatus(account.id, {
        status: operationStatus,
        isComplete: true,
        isFailed: false,
        statusReason: operationReason
      }, operation);

      logger.info({
        accountId: account.id,
        subscriptionTier: 'public',
        operation,
        finalStatus: operationStatus
      }, 'Poll Infrastructure Worker - Public account completed immediately');

      return response;
    }

    // For private accounts, continue with CloudFormation polling
    logger.info({
      accountId: account.id,
      subscriptionTier: 'private',
      operation
    }, 'Private account detected - proceeding with CloudFormation polling');

    // For private accounts, stackId is required for CloudFormation polling
    const attempts = (metadata?.attempts || 0) + 1;
    const accountId = account.id;
    const stackId = infrastructure.stackId;

    if (!stackId) {
      throw new Error('Invalid input: stackId is required for private account CloudFormation polling');
    }

    logger.info({
      accountId,
      stackId,
      attempts,
      maxAttempts: config.CLOUDFORMATION.MAX_POLL_ATTEMPTS
    }, 'Processing infrastructure status polling request');

    // Record polling attempt
    await dynamoDBService.recordPollingAttempt(accountId, attempts);

    // Step 1: Assume cross-account role
    logger.info({ accountId, attempts }, 'Step 1: Assuming cross-account role');
    const credentials = await crossAccountService.assumeAccountRole(
      infrastructure.targetAccountId,
      accountId
    );

    // Step 2: Create CloudFormation client
    logger.info({ accountId, attempts }, 'Step 2: Creating CloudFormation client');
    const cloudFormationClient = crossAccountService.createCloudFormationClient(
      credentials,
      account.region
    );
    const stackPollingService = new StackPollingService(cloudFormationClient);

    // Step 3: Poll stack status
    logger.info({ accountId, stackId, attempts }, 'Step 3: Polling stack status');
    const stackData = await stackPollingService.pollStackStatus(stackId, accountId);

    // Step 4: Check polling decision
    const pollingDecision = stackPollingService.shouldContinuePolling(stackData.status, attempts);
    
    logger.info({
      accountId,
      stackId,
      stackStatus: stackData.status,
      pollingDecision
    }, 'Step 4: Evaluated polling decision');

    // Step 5: Update account registry
    logger.info({ accountId, stackStatus: stackData.status }, 'Step 5: Updating account registry');
    await dynamoDBService.updateAccountInfrastructureStatus(accountId, stackData, operation);

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
        accountId,
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
        accountId,
        stackId,
        attempts,
        outputs: Object.keys(stackData.outputs)
      }, 'Poll Infrastructure Worker - Stack completed successfully');

      return response;

    } else if (pollingDecision.finalStatus === 'TIMEOUT') {
      // Polling timeout reached
      await dynamoDBService.recordPollingTimeout(accountId, attempts);

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
        accountId,
        stackId,
        attempts,
        maxAttempts: config.CLOUDFORMATION.MAX_POLL_ATTEMPTS
      }, 'Poll Infrastructure Worker - Polling timeout reached');

      throw new Error(JSON.stringify(response));

    } else {
      // Stack failed or unknown status
      const stackEvents = await stackPollingService.getStackEvents(stackId, accountId);
      
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
        accountId,
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
    accountId: 'account-test-123',
    accountName: 'test-company-public',
    subscriptionTier: 'public',
    email: 'test@example.com',
    createdBy: 'admin',
    registeredOn: new Date().toISOString(),
    infrastructure: {
      targetAccountId: process.env.ACCOUNT_ACCOUNT_ID || '949642303066',
      stackName: 'ACCOUNT_PUBLIC',
      status: 'CREATE_COMPLETE'
    }
  };

  const testEventPrivate = {
    operation: 'CREATE',
    accountId: 'account-test-456',
    accountName: 'test-company-private',
    subscriptionTier: 'private',
    email: 'test-private@example.com',
    createdBy: 'admin',
    registeredOn: new Date().toISOString(),
    infrastructure: {
      targetAccountId: process.env.ACCOUNT_ACCOUNT_ID || '949642303066',
      stackId: 'arn:aws:cloudformation:us-east-1:949642303066:stack/account-test-456-dynamodb/12345678-1234-1234-1234-123456789012',
      stackName: 'account-test-456-dynamodb',
      status: 'CREATE_IN_PROGRESS'
    }
  };

  const testContext = {
    awsRequestId: 'local-test-request',
    functionName: 'poll-infra-worker-local',
    functionVersion: '1.0',
    getRemainingTimeInMillis: () => 300000 // 5 minutes
  };

  // Test public account (should complete immediately)
  console.log('Testing PUBLIC account polling...');
  exports.handler(testEventPublic, testContext)
    .then(result => {
      console.log('Public account success:', JSON.stringify(result, null, 2));
      
      // Test private account (should poll CloudFormation)
      console.log('\nTesting PRIVATE account polling...');
      return exports.handler(testEventPrivate, testContext);
    })
    .then(result => {
      console.log('Private account success:', JSON.stringify(result, null, 2));
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