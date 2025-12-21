const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');
const moment = require('moment');

class DynamoDBService {
  constructor(credentials, targetAccountId) {
    this.mode = credentials ? 'cross-account' : 'admin-account';
    this.credentials = credentials;
    this.targetAccountId = targetAccountId;
    
    // Configure DynamoDB client
    if (credentials) {
      // Cross-account mode with assumed role credentials
      this.dynamodb = new AWS.DynamoDB({
        region: config.AWS.REGION,
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken
      });
      
      this.docClient = new AWS.DynamoDB.DocumentClient({
        region: config.AWS.REGION,
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken
      });
    } else {
      // Admin account mode with default credentials
      this.dynamodb = new AWS.DynamoDB({ region: config.AWS.REGION });
      this.docClient = new AWS.DynamoDB.DocumentClient({ region: config.AWS.REGION });
    }
  }

  /**
   * Delete ALL account entries from public shared table (ACCOUNT_PUBLIC)
   * Used for public subscription tier accounts - deletes all rows where pk = ACCOUNT#<account_id>
   */
  async deleteAccountEntryFromPublicTable(accountData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      accountId: accountData.accountId,
      subscriptionTier: 'public',
      targetAccount: this.targetAccountId
    }, 'Deleting ALL account entries from public shared table');

    try {
      const tableName = config.DYNAMODB.ACCOUNT_PUBLIC_TABLE;
      const accountPk = `ACCOUNT#${accountData.accountId}`;
      
      // Step 1: Query all items for this account (handle pagination)
      const queryParams = {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': accountPk
        }
      };

      logger.info({
        accountId: accountData.accountId,
        tableName,
        queryKey: accountPk
      }, 'Querying all account entries from public table');

      let allItems = [];
      let lastEvaluatedKey = null;
      let queryCount = 0;

      // Handle pagination - keep querying until no more results
      do {
        if (lastEvaluatedKey) {
          queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        queryCount++;
        logger.debug({
          accountId: accountData.accountId,
          queryCount,
          hasStartKey: !!lastEvaluatedKey
        }, 'Executing paginated query');

        const queryResult = await this.docClient.query(queryParams).promise();
        
        if (queryResult.Items && queryResult.Items.length > 0) {
          allItems = allItems.concat(queryResult.Items);
        }

        lastEvaluatedKey = queryResult.LastEvaluatedKey;
        
        logger.debug({
          accountId: accountData.accountId,
          itemsInThisQuery: queryResult.Items ? queryResult.Items.length : 0,
          totalItemsSoFar: allItems.length,
          hasMorePages: !!lastEvaluatedKey
        }, 'Query page completed');

      } while (lastEvaluatedKey);

      logger.info({
        accountId: accountData.accountId,
        tableName,
        totalQueries: queryCount,
        totalItemsFound: allItems.length
      }, `Completed pagination - found ${allItems.length} total items across ${queryCount} queries`);

      if (allItems.length === 0) {
        logger.warn({
          accountId: accountData.accountId,
          tableName
        }, 'No account entries found to delete (may have already been deleted)');
        
        return {
          success: true,
          operation: 'DELETE_ACCOUNT_ENTRIES',
          accountId: accountData.accountId,
          tableName: tableName,
          deletedCount: 0,
          message: 'No entries found (may have already been deleted)',
          deletedAt: moment().toISOString()
        };
      }

      logger.info({
        accountId: accountData.accountId,
        tableName,
        itemCount: allItems.length
      }, `Found ${allItems.length} account entries to delete`);

      // Step 2: Delete all items using batch write
      const deleteRequests = allItems.map(item => ({
        DeleteRequest: {
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }
      }));

      let deletedCount = 0;
      const batchSize = 25; // DynamoDB batch write limit

      // Process deletions in batches of 25
      for (let i = 0; i < deleteRequests.length; i += batchSize) {
        const batch = deleteRequests.slice(i, i + batchSize);
        
        const batchWriteParams = {
          RequestItems: {
            [tableName]: batch
          }
        };

        logger.debug({
          accountId: accountData.accountId,
          batchNumber: Math.floor(i / batchSize) + 1,
          itemsInBatch: batch.length,
          totalBatches: Math.ceil(deleteRequests.length / batchSize)
        }, 'Executing batch delete');

        // Handle potential unprocessed items in batch write
        let unprocessedItems = batchWriteParams;
        let retryCount = 0;
        const maxRetries = 3;

        do {
          const batchResult = await this.docClient.batchWrite(unprocessedItems).promise();
          
          if (batchResult.UnprocessedItems && Object.keys(batchResult.UnprocessedItems).length > 0) {
            unprocessedItems = { RequestItems: batchResult.UnprocessedItems };
            retryCount++;
            
            logger.warn({
              accountId: accountData.accountId,
              retryCount,
              unprocessedCount: batchResult.UnprocessedItems[tableName] ? batchResult.UnprocessedItems[tableName].length : 0
            }, 'Retrying unprocessed items in batch delete');
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          } else {
            unprocessedItems = null;
          }
        } while (unprocessedItems && retryCount < maxRetries);

        if (unprocessedItems) {
          logger.error({
            accountId: accountData.accountId,
            unprocessedItems
          }, 'Failed to delete some items after maximum retries');
        }

        deletedCount += batch.length;
      }

      logger.info({
        accountId: accountData.accountId,
        tableName,
        deletedCount,
        totalBatches: Math.ceil(deleteRequests.length / batchSize),
        originalItems: allItems.length
      }, 'Successfully deleted all account entries from public table');

      return {
        success: true,
        operation: 'DELETE_ACCOUNT_ENTRIES',
        accountId: accountData.accountId,
        tableName: tableName,
        deletedCount: deletedCount,
        deletedItems: allItems,
        totalQueries: queryCount,
        deletedAt: moment().toISOString()
      };

    } catch (error) {
      logger.error({
        error: error.message,
        accountId: accountData.accountId,
        targetAccount: this.targetAccountId
      }, 'Failed to delete account entries from public table');

      return {
        success: false,
        operation: 'DELETE_ACCOUNT_ENTRIES',
        error: error.message
      };
    }
  }

  /**
   * Delete account's dedicated DynamoDB table via CloudFormation stack deletion
   * Used for private subscription tier accounts
   */
  async deleteAccountDynamoDBTable(accountData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      accountId: accountData.accountId,
      subscriptionTier: 'private',
      targetAccount: this.targetAccountId,
      stackId: accountData.stackId
    }, 'Initiating CloudFormation stack deletion for private account table');

    try {
      // Configure CloudFormation with the cross-account credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.AWS.REGION,
        accessKeyId: this.credentials.AccessKeyId,
        secretAccessKey: this.credentials.SecretAccessKey,
        sessionToken: this.credentials.SessionToken
      });

      // stackId should be provided from Step Functions input (from infrastructure object)
      const stackId = accountData.stackId;
      
      if (!stackId) {
        throw new Error('Invalid input: stackId is required for CloudFormation stack deletion');
      }

      logger.info({
        accountId: accountData.accountId,
        stackId
      }, 'Using stackId from Step Functions input for stack deletion');
      
      // Check if stack exists before attempting deletion
      try {
        const describeResult = await cloudFormation.describeStacks({
          StackName: stackId // Use stackId for stack lookup
        }).promise();
        
        if (!describeResult.Stacks || describeResult.Stacks.length === 0) {
          logger.warn({
            stackId,
            accountId: accountData.accountId
          }, 'CloudFormation stack not found (may have already been deleted)');
          
          return {
            success: true,
            operation: 'DELETE_DYNAMODB_TABLE',
            accountId: accountData.accountId,
            stackId: stackId,
            message: 'Stack not found (may have already been deleted)',
            deletedAt: moment().toISOString()
          };
        }
      } catch (describeError) {
        if (describeError.code === 'ValidationError' && describeError.message.includes('does not exist')) {
          logger.warn({
            stackId,
            accountId: accountData.accountId
          }, 'CloudFormation stack does not exist (may have already been deleted)');
          
          return {
            success: true,
            operation: 'DELETE_DYNAMODB_TABLE',
            accountId: accountData.accountId,
            stackId: stackId,
            message: 'Stack does not exist (may have already been deleted)',
            deletedAt: moment().toISOString()
          };
        }
        throw describeError;
      }

      // Delete CloudFormation stack using stackId
      logger.info({
        stackId,
        accountId: accountData.accountId
      }, 'Initiating CloudFormation stack deletion');

      const deleteStackResult = await cloudFormation.deleteStack({
        StackName: stackId // CloudFormation stack deletion using stackId
      }).promise();

      logger.info({
        stackId,
        accountId: accountData.accountId
      }, 'CloudFormation stack deletion initiated successfully');

      const tableName = `ACCOUNT_${accountData.accountId}`;

      return {
        success: true,
        operation: 'DELETE_DYNAMODB_TABLE',
        accountId: accountData.accountId,
        tableName: tableName,
        stackId: stackId,
        status: 'DELETE_IN_PROGRESS',
        deletedAt: moment().toISOString()
      };

    } catch (error) {
      logger.error({
        error: error.message,
        accountId: accountData.accountId,
        targetAccount: this.targetAccountId
      }, 'Failed to initiate CloudFormation stack deletion for private account');

      return {
        success: false,
        operation: 'DELETE_DYNAMODB_TABLE',
        error: error.message
      };
    }
  }

  /**
   * Update account infrastructure status in admin account registry
   * Called from admin account context
   */
  async updateAccountInfrastructure(accountId, updateData) {
    if (this.mode !== 'admin-account') {
      throw new Error('This method requires admin-account mode');
    }

    logger.info({
      accountId,
      updateData
    }, 'Updating account infrastructure status in admin account registry');

    try {
      const params = {
        TableName: config.DYNAMODB.ACCOUNT_REGISTRY_TABLE,
        Key: {
          PK: `ACCOUNT#${accountId}`,
          SK: 'METADATA'
        },
        UpdateExpression: 'SET lastModified = :lastModified',
        ExpressionAttributeValues: {
          ':lastModified': moment().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      // Map updateData.status to provisioningState for correct schema
      if (updateData.status) {
        params.UpdateExpression += ', provisioningState = :provisioningState';
        // Map status values to correct provisioningState values
        let provisioningState = updateData.status;
        if (updateData.status === 'DELETE_COMPLETE') {
          provisioningState = 'deleted';
        } else if (updateData.status === 'DELETE_FAILED') {
          provisioningState = 'deletion_failed';
        } else if (updateData.status === 'CREATE_COMPLETE') {
          provisioningState = 'active';
        } else if (updateData.status === 'CREATE_FAILED') {
          provisioningState = 'failed';
        }
        params.ExpressionAttributeValues[':provisioningState'] = provisioningState;
      }

      // Add optional fields if provided
      if (updateData.stackName && updateData.stackName !== 'ACCOUNT_PUBLIC') {
        params.UpdateExpression += ', accountTableName = :accountTableName';
        params.ExpressionAttributeValues[':accountTableName'] = updateData.stackName;
      }

      if (updateData.stackId) {
        params.UpdateExpression += ', cloudFormationStackId = :cloudFormationStackId';
        params.ExpressionAttributeValues[':cloudFormationStackId'] = updateData.stackId;
      }

      if (updateData.deletedAt) {
        params.UpdateExpression += ', deletedAt = :deletedAt';
        params.ExpressionAttributeValues[':deletedAt'] = updateData.deletedAt;
      }

      const result = await this.docClient.update(params).promise();
      
      logger.info({
        accountId,
        updatedAttributes: result.Attributes
      }, 'Successfully updated account infrastructure status in admin account');

      return result.Attributes;

    } catch (error) {
      logger.error({
        error: error.message,
        accountId,
        updateData
      }, 'Failed to update account infrastructure status in admin account');
      
      throw error;
    }
  }

  /**
   * Record deletion attempt for tracking
   */
  async recordDeletionAttempt(accountId, attempts) {
    logger.info({
      accountId,
      attempts
    }, 'Recording deletion attempt');

    try {
      const params = {
        TableName: config.DYNAMODB.ACCOUNT_REGISTRY_TABLE,
        Key: {
          PK: `ACCOUNT#${accountId}`,
          SK: 'METADATA'
        },
        UpdateExpression: 'SET deletionAttempts = :attempts, lastDeletionAttempt = :timestamp',
        ExpressionAttributeValues: {
          ':attempts': attempts,
          ':timestamp': moment().toISOString()
        },
        ReturnValues: 'NONE'
      };

      await this.docClient.update(params).promise();
      
      logger.debug({
        accountId,
        attempts
      }, 'Successfully recorded deletion attempt');

    } catch (error) {
      logger.warn({
        error: error.message,
        accountId,
        attempts
      }, 'Failed to record deletion attempt (non-critical)');
    }
  }

  /**
   * Update account infrastructure status with deletion details
   */
  async updateAccountInfrastructureStatus(accountId, statusUpdate) {
    logger.info({
      accountId,
      statusUpdate
    }, 'Updating account infrastructure deletion status');

    try {
      const params = {
        TableName: config.DYNAMODB.ACCOUNT_REGISTRY_TABLE,
        Key: {
          PK: `ACCOUNT#${accountId}`,
          SK: 'METADATA'
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': statusUpdate.status,
          ':updatedAt': moment().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      // Add optional status fields
      if (statusUpdate.statusReason) {
        params.UpdateExpression += ', statusReason = :statusReason';
        params.ExpressionAttributeValues[':statusReason'] = statusUpdate.statusReason;
      }

      if (statusUpdate.isComplete !== undefined) {
        params.UpdateExpression += ', isComplete = :isComplete';
        params.ExpressionAttributeValues[':isComplete'] = statusUpdate.isComplete;
      }

      if (statusUpdate.isFailed !== undefined) {
        params.UpdateExpression += ', isFailed = :isFailed';
        params.ExpressionAttributeValues[':isFailed'] = statusUpdate.isFailed;
      }

      const result = await this.docClient.update(params).promise();
      
      logger.info({
        accountId,
        updatedAttributes: result.Attributes
      }, 'Successfully updated account infrastructure deletion status');

      return result.Attributes;

    } catch (error) {
      logger.error({
        error: error.message,
        accountId,
        statusUpdate
      }, 'Failed to update account infrastructure deletion status');
      
      throw error;
    }
  }
}

module.exports = DynamoDBService;