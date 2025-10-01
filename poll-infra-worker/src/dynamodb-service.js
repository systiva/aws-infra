const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');
const moment = require('moment');

// Configure AWS SDK to use VPC endpoints when in private subnet
AWS.config.update({
  region: config.DYNAMODB.REGION,
  maxRetries: 3,
  retryDelayOptions: {
    customBackoff: function(retryCount) {
      return Math.pow(2, retryCount) * 100;
    }
  }
});

class DynamoDBService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient({
      region: config.DYNAMODB.REGION
    });
    this.tableName = config.DYNAMODB.TENANT_REGISTRY_TABLE;
  }

  /**
   * Update tenant registry with infrastructure status
   * @param {string} tenantId - Tenant ID
   * @param {Object} stackData - Stack polling data
   * @param {string} operation - Operation type (CREATE or DELETE)
   * @returns {Promise} Update result
   */
  async updateTenantInfrastructureStatus(tenantId, stackData, operation = 'CREATE') {
    logger.info({
      tenantId,
      stackStatus: stackData.status,
      isComplete: stackData.isComplete,
      isFailed: stackData.isFailed
    }, 'Updating tenant registry with infrastructure status');

    const updateParams = {
      TableName: this.tableName,
      Key: { 
        pk: `TENANT#${tenantId}`,
        sk: 'METADATA'
      },
      UpdateExpression: `SET 
        provisioningState = :status,
        #lastModified = :updatedAt`,
      ExpressionAttributeNames: {
        '#lastModified': 'lastModified'
      },
      ExpressionAttributeValues: {
        ':status': this.mapStackStatusToTenantStatus(stackData.status, stackData.isComplete, stackData.isFailed, operation),
        ':updatedAt': new Date().toISOString()
      }
    };

    // Add completion data if stack is complete
    if (stackData.isComplete) {
      updateParams.UpdateExpression += `, 
        provisioningCompletedAt = :completedAt`;
      
      updateParams.ExpressionAttributeValues[':completedAt'] = new Date().toISOString();
    }

    // Add failure data if stack failed
    if (stackData.isFailed) {
      updateParams.UpdateExpression += `, 
        provisioningFailedAt = :failedAt`;
      
      updateParams.ExpressionAttributeValues[':failedAt'] = new Date().toISOString();
    }

    updateParams.ReturnValues = 'ALL_NEW';

    try {
      const result = await this.dynamodb.update(updateParams).promise();
      
      logger.info({
        tenantId,
        updatedStatus: result.Attributes.provisioningState
      }, 'Successfully updated tenant registry');

      return result.Attributes;
    } catch (error) {
      logger.error({
        error: error.message,
        tenantId,
        tableName: this.tableName
      }, 'Failed to update tenant registry');
      throw error;
    }
  }

  /**
   * Map CloudFormation stack status to tenant status
   * @param {string} stackStatus - CloudFormation status
   * @param {boolean} isComplete - Is stack complete
   * @param {boolean} isFailed - Is stack failed
   * @param {string} operation - Operation type (CREATE or DELETE)
   * @returns {string} Tenant status
   */
  mapStackStatusToTenantStatus(stackStatus, isComplete, isFailed, operation = 'CREATE') {
    if (isComplete) {
      // For DELETE operations, mark as deleted when complete
      if (operation === 'DELETE') {
        return 'deleted';
      }
      // For CREATE operations, mark as active when complete
      return 'active';
    }
    
    if (isFailed) {
      return 'failed';
    }
    
    // Still in progress - use operation-specific status
    if (operation === 'DELETE') {
      return 'deleting';
    }
    return 'creating';
  }

  /**
   * Get tenant from registry
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Tenant data
   */
  async getTenant(tenantId) {
    logger.debug({ tenantId }, 'Retrieving tenant from registry');

    const params = {
      TableName: this.tableName,
      Key: { 
        pk: `TENANT#${tenantId}`,
        sk: 'METADATA'
      }
    };

    try {
      const result = await this.dynamodb.get(params).promise();
      
      if (!result.Item) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      return result.Item;
    } catch (error) {
      logger.error({
        error: error.message,
        tenantId
      }, 'Failed to retrieve tenant from registry');
      throw error;
    }
  }

  /**
   * Record polling attempt
   * @param {string} tenantId - Tenant ID
   * @param {number} attempts - Number of polling attempts
   * @returns {Promise} Update result
   */
  async recordPollingAttempt(tenantId, attempts) {
    logger.debug({
      tenantId,
      attempts
    }, 'Recording polling attempt');

    const updateParams = {
      TableName: this.tableName,
      Key: { 
        pk: `TENANT#${tenantId}`,
        sk: 'METADATA'
      },
      UpdateExpression: `SET 
        pollingAttempts = :attempts,
        lastPolledAt = :lastPolled`,
      ExpressionAttributeValues: {
        ':attempts': attempts,
        ':lastPolled': new Date().toISOString()
      }
    };

    try {
      await this.dynamodb.update(updateParams).promise();
    } catch (error) {
      logger.error({
        error: error.message,
        tenantId
      }, 'Failed to record polling attempt');
      // Don't throw - this is not critical
    }
  }

  /**
   * Record polling timeout
   * @param {string} tenantId - Tenant ID
   * @param {number} totalAttempts - Total polling attempts made
   * @returns {Promise} Update result
   */
  async recordPollingTimeout(tenantId, totalAttempts) {
    logger.warn({
      tenantId,
      totalAttempts
    }, 'Recording polling timeout');

    const updateParams = {
      TableName: this.tableName,
      Key: { 
        pk: `TENANT#${tenantId}`,
        sk: 'METADATA'
      },
      UpdateExpression: `SET 
        provisioningState = :status,
        pollingTimeoutAt = :timeoutAt,
        totalPollingAttempts = :totalAttempts,
        lastModified = :updatedAt`,
      ExpressionAttributeValues: {
        ':status': 'timeout',
        ':timeoutAt': new Date().toISOString(),
        ':totalAttempts': totalAttempts,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await this.dynamodb.update(updateParams).promise();
      return result.Attributes;
    } catch (error) {
      logger.error({
        error: error.message,
        tenantId
      }, 'Failed to record polling timeout');
      throw error;
    }
  }
}

module.exports = DynamoDBService;