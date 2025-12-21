const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');
const moment = require('moment');

class StackPollingService {
  constructor(cloudformationClient) {
    this.cloudformation = cloudformationClient;
  }

  /**
   * Poll CloudFormation stack status
   * @param {string} stackId - CloudFormation stack ID or name
   * @param {string} accountId - Account identifier for logging
   * @returns {Object} Stack status and details
   */
  async pollStackStatus(stackId, accountId) {
    logger.info({
      stackId,
      accountId
    }, 'Polling CloudFormation stack status');

    try {
      const params = {
        StackName: stackId
      };

      const result = await this.cloudformation.describeStacks(params).promise();
      
      if (!result.Stacks || result.Stacks.length === 0) {
        throw new Error(`Stack not found: ${stackId}`);
      }

      const stack = result.Stacks[0];
      const status = stack.StackStatus;
      
      logger.info({
        stackId,
        accountId,
        stackStatus: status,
        stackName: stack.StackName
      }, 'Retrieved stack status');

      return {
        stackId: stack.StackId,
        stackName: stack.StackName,
        status: status,
        statusReason: stack.StackStatusReason,
        creationTime: stack.CreationTime,
        lastUpdatedTime: stack.LastUpdatedTime,
        outputs: this.extractStackOutputs(stack.Outputs || []),
        parameters: this.extractStackParameters(stack.Parameters || []),
        isComplete: this.isStackComplete(status),
        isFailed: this.isStackFailed(status),
        isInProgress: this.isStackInProgress(status)
      };
    } catch (error) {
      logger.error({
        error: error.message,
        stackId,
        accountId
      }, 'Failed to poll stack status');
      throw error;
    }
  }

  /**
   * Extract stack outputs into a key-value object
   * @param {Array} outputs - CloudFormation stack outputs
   * @returns {Object} Outputs as key-value pairs
   */
  extractStackOutputs(outputs) {
    return outputs.reduce((acc, output) => {
      acc[output.OutputKey] = {
        value: output.OutputValue,
        description: output.Description,
        exportName: output.ExportName
      };
      return acc;
    }, {});
  }

  /**
   * Extract stack parameters into a key-value object
   * @param {Array} parameters - CloudFormation stack parameters
   * @returns {Object} Parameters as key-value pairs
   */
  extractStackParameters(parameters) {
    return parameters.reduce((acc, param) => {
      acc[param.ParameterKey] = param.ParameterValue;
      return acc;
    }, {});
  }

  /**
   * Check if stack is in a complete state
   * @param {string} status - CloudFormation stack status
   * @returns {boolean} Is complete
   */
  isStackComplete(status) {
    return config.CLOUDFORMATION.COMPLETE_STATUSES.includes(status);
  }

  /**
   * Check if stack is in a failed state
   * @param {string} status - CloudFormation stack status
   * @returns {boolean} Is failed
   */
  isStackFailed(status) {
    return config.CLOUDFORMATION.FAILED_STATUSES.includes(status);
  }

  /**
   * Check if stack is still in progress
   * @param {string} status - CloudFormation stack status
   * @returns {boolean} Is in progress
   */
  isStackInProgress(status) {
    return config.CLOUDFORMATION.IN_PROGRESS_STATUSES.includes(status);
  }

  /**
   * Get stack events for troubleshooting
   * @param {string} stackId - CloudFormation stack ID
   * @param {string} accountId - Account identifier for logging
   * @returns {Array} Recent stack events
   */
  async getStackEvents(stackId, accountId) {
    logger.debug({
      stackId,
      accountId
    }, 'Retrieving stack events');

    try {
      const params = {
        StackName: stackId,
        MaxRecords: 20 // Get last 20 events
      };

      const result = await this.cloudformation.describeStackEvents(params).promise();
      
      const events = result.StackEvents.map(event => ({
        timestamp: event.Timestamp,
        logicalResourceId: event.LogicalResourceId,
        physicalResourceId: event.PhysicalResourceId,
        resourceType: event.ResourceType,
        resourceStatus: event.ResourceStatus,
        resourceStatusReason: event.ResourceStatusReason
      }));

      logger.debug({
        stackId,
        accountId,
        eventCount: events.length
      }, 'Retrieved stack events');

      return events;
    } catch (error) {
      logger.error({
        error: error.message,
        stackId,
        accountId
      }, 'Failed to retrieve stack events');
      return []; // Return empty array on error
    }
  }

  /**
   * Check if polling should continue based on attempts and status
   * @param {string} status - Current stack status
   * @param {number} attempts - Number of polling attempts so far
   * @returns {Object} Polling decision
   */
  shouldContinuePolling(status, attempts) {
    const maxAttempts = config.CLOUDFORMATION.MAX_POLL_ATTEMPTS;
    
    if (this.isStackComplete(status)) {
      return {
        shouldContinue: false,
        reason: 'Stack completed successfully',
        finalStatus: 'COMPLETE'
      };
    }

    if (this.isStackFailed(status)) {
      return {
        shouldContinue: false,
        reason: 'Stack failed',
        finalStatus: 'FAILED'
      };
    }

    if (attempts >= maxAttempts) {
      return {
        shouldContinue: false,
        reason: 'Maximum polling attempts reached',
        finalStatus: 'TIMEOUT'
      };
    }

    if (this.isStackInProgress(status)) {
      return {
        shouldContinue: true,
        reason: 'Stack still in progress',
        finalStatus: 'IN_PROGRESS'
      };
    }

    // Unknown status, stop polling
    return {
      shouldContinue: false,
      reason: `Unknown stack status: ${status}`,
      finalStatus: 'UNKNOWN'
    };
  }
}

module.exports = StackPollingService;