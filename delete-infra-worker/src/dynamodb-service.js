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
   * Delete ALL tenant entries from public shared table (TENANT_PUBLIC)
   * Used for public subscription tier tenants - deletes all rows where pk = TENANT#<tenant_id>
   */
  async deleteTenantEntryFromPublicTable(tenantData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      tenantId: tenantData.tenantId,
      subscriptionTier: 'public',
      targetAccount: this.targetAccountId
    }, 'Deleting ALL tenant entries from public shared table');

    try {
      const tableName = config.DYNAMODB.TENANT_PUBLIC_TABLE;
      const tenantPk = `TENANT#${tenantData.tenantId}`;
      
      // Step 1: Query all items for this tenant (handle pagination)
      const queryParams = {
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': tenantPk
        }
      };

      logger.info({
        tenantId: tenantData.tenantId,
        tableName,
        queryKey: tenantPk
      }, 'Querying all tenant entries from public table');

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
          tenantId: tenantData.tenantId,
          queryCount,
          hasStartKey: !!lastEvaluatedKey
        }, 'Executing paginated query');

        const queryResult = await this.docClient.query(queryParams).promise();
        
        if (queryResult.Items && queryResult.Items.length > 0) {
          allItems = allItems.concat(queryResult.Items);
        }

        lastEvaluatedKey = queryResult.LastEvaluatedKey;
        
        logger.debug({
          tenantId: tenantData.tenantId,
          itemsInThisQuery: queryResult.Items ? queryResult.Items.length : 0,
          totalItemsSoFar: allItems.length,
          hasMorePages: !!lastEvaluatedKey
        }, 'Query page completed');

      } while (lastEvaluatedKey);

      logger.info({
        tenantId: tenantData.tenantId,
        tableName,
        totalQueries: queryCount,
        totalItemsFound: allItems.length
      }, `Completed pagination - found ${allItems.length} total items across ${queryCount} queries`);

      if (allItems.length === 0) {
        logger.warn({
          tenantId: tenantData.tenantId,
          tableName
        }, 'No tenant entries found to delete (may have already been deleted)');
        
        return {
          success: true,
          operation: 'DELETE_TENANT_ENTRIES',
          tenantId: tenantData.tenantId,
          tableName: tableName,
          deletedCount: 0,
          message: 'No entries found (may have already been deleted)',
          deletedAt: moment().toISOString()
        };
      }

      logger.info({
        tenantId: tenantData.tenantId,
        tableName,
        itemCount: allItems.length
      }, `Found ${allItems.length} tenant entries to delete`);

      // Step 2: Delete all items using batch write
      const deleteRequests = allItems.map(item => ({
        DeleteRequest: {
          Key: {
            pk: item.pk,
            sk: item.sk
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
          tenantId: tenantData.tenantId,
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
              tenantId: tenantData.tenantId,
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
            tenantId: tenantData.tenantId,
            unprocessedItems
          }, 'Failed to delete some items after maximum retries');
        }

        deletedCount += batch.length;
      }

      logger.info({
        tenantId: tenantData.tenantId,
        tableName,
        deletedCount,
        totalBatches: Math.ceil(deleteRequests.length / batchSize),
        originalItems: allItems.length
      }, 'Successfully deleted all tenant entries from public table');

      return {
        success: true,
        operation: 'DELETE_TENANT_ENTRIES',
        tenantId: tenantData.tenantId,
        tableName: tableName,
        deletedCount: deletedCount,
        deletedItems: allItems,
        totalQueries: queryCount,
        deletedAt: moment().toISOString()
      };

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId: tenantData.tenantId,
        targetAccount: this.targetAccountId
      }, 'Failed to delete tenant entries from public table');

      return {
        success: false,
        operation: 'DELETE_TENANT_ENTRIES',
        error: error.message
      };
    }
  }

  /**
   * Delete tenant's dedicated DynamoDB table via CloudFormation stack deletion
   * Used for private subscription tier tenants
   */
  async deleteTenantDynamoDBTable(tenantData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      tenantId: tenantData.tenantId,
      subscriptionTier: 'private',
      targetAccount: this.targetAccountId,
      stackId: tenantData.stackId
    }, 'Initiating CloudFormation stack deletion for private tenant table');

    try {
      // Configure CloudFormation with the cross-account credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.AWS.REGION,
        accessKeyId: this.credentials.AccessKeyId,
        secretAccessKey: this.credentials.SecretAccessKey,
        sessionToken: this.credentials.SessionToken
      });

      // stackId should be provided from Step Functions input (from infrastructure object)
      const stackId = tenantData.stackId;
      
      if (!stackId) {
        throw new Error('Invalid input: stackId is required for CloudFormation stack deletion');
      }

      logger.info({
        tenantId: tenantData.tenantId,
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
            tenantId: tenantData.tenantId
          }, 'CloudFormation stack not found (may have already been deleted)');
          
          return {
            success: true,
            operation: 'DELETE_DYNAMODB_TABLE',
            tenantId: tenantData.tenantId,
            stackId: stackId,
            message: 'Stack not found (may have already been deleted)',
            deletedAt: moment().toISOString()
          };
        }
      } catch (describeError) {
        if (describeError.code === 'ValidationError' && describeError.message.includes('does not exist')) {
          logger.warn({
            stackId,
            tenantId: tenantData.tenantId
          }, 'CloudFormation stack does not exist (may have already been deleted)');
          
          return {
            success: true,
            operation: 'DELETE_DYNAMODB_TABLE',
            tenantId: tenantData.tenantId,
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
        tenantId: tenantData.tenantId
      }, 'Initiating CloudFormation stack deletion');

      const deleteStackResult = await cloudFormation.deleteStack({
        StackName: stackId // CloudFormation stack deletion using stackId
      }).promise();

      logger.info({
        stackId,
        tenantId: tenantData.tenantId
      }, 'CloudFormation stack deletion initiated successfully');

      const tableName = `TENANT_${tenantData.tenantId}`;

      return {
        success: true,
        operation: 'DELETE_DYNAMODB_TABLE',
        tenantId: tenantData.tenantId,
        tableName: tableName,
        stackId: stackId,
        status: 'DELETE_IN_PROGRESS',
        deletedAt: moment().toISOString()
      };

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId: tenantData.tenantId,
        targetAccount: this.targetAccountId
      }, 'Failed to initiate CloudFormation stack deletion for private tenant');

      return {
        success: false,
        operation: 'DELETE_DYNAMODB_TABLE',
        error: error.message
      };
    }
  }

  /**
   * Update tenant infrastructure status in admin account registry
   * Called from admin account context
   */
  async updateTenantInfrastructure(tenantId, updateData) {
    if (this.mode !== 'admin-account') {
      throw new Error('This method requires admin-account mode');
    }

    logger.info({
      tenantId,
      updateData
    }, 'Updating tenant infrastructure status in admin account registry');

    try {
      const params = {
        TableName: config.DYNAMODB.TENANT_REGISTRY_TABLE,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: 'METADATA'
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
      if (updateData.stackName && updateData.stackName !== 'TENANT_PUBLIC') {
        params.UpdateExpression += ', tenantTableName = :tenantTableName';
        params.ExpressionAttributeValues[':tenantTableName'] = updateData.stackName;
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
        tenantId,
        updatedAttributes: result.Attributes
      }, 'Successfully updated tenant infrastructure status in admin account');

      return result.Attributes;

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId,
        updateData
      }, 'Failed to update tenant infrastructure status in admin account');
      
      throw error;
    }
  }

  /**
   * Record deletion attempt for tracking
   */
  async recordDeletionAttempt(tenantId, attempts) {
    logger.info({
      tenantId,
      attempts
    }, 'Recording deletion attempt');

    try {
      const params = {
        TableName: config.DYNAMODB.TENANT_REGISTRY_TABLE,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: 'METADATA'
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
        tenantId,
        attempts
      }, 'Successfully recorded deletion attempt');

    } catch (error) {
      logger.warn({
        error: error.message,
        tenantId,
        attempts
      }, 'Failed to record deletion attempt (non-critical)');
    }
  }

  /**
   * Update tenant infrastructure status with deletion details
   */
  async updateTenantInfrastructureStatus(tenantId, statusUpdate) {
    logger.info({
      tenantId,
      statusUpdate
    }, 'Updating tenant infrastructure deletion status');

    try {
      const params = {
        TableName: config.DYNAMODB.TENANT_REGISTRY_TABLE,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: 'METADATA'
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
        tenantId,
        updatedAttributes: result.Attributes
      }, 'Successfully updated tenant infrastructure deletion status');

      return result.Attributes;

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId,
        statusUpdate
      }, 'Failed to update tenant infrastructure deletion status');
      
      throw error;
    }
  }
}

module.exports = DynamoDBService;