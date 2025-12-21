const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');

class CrossAccountService {
  constructor() {
    this.sts = new AWS.STS({ region: config.AWS.REGION });
  }

  /**
   * Assume cross-account role for account infrastructure operations
   * @param {string} accountAccountId - Target account account ID
   * @param {string} accountId - Unique account identifier
   * @returns {Object} AWS credentials for assumed role
   */
  async assumeAccountRole(accountAccountId, accountId) {
    const roleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.ROLE_NAME}`;
    const sessionName = `${config.CROSS_ACCOUNT.SESSION_NAME}-${accountId}`;
    
    logger.info({
      roleArn,
      sessionName,
      accountAccountId,
      accountId
    }, 'Assuming cross-account role for polling');

    try {
      const params = {
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: config.CROSS_ACCOUNT.ASSUME_ROLE_DURATION
        // Remove Tags to avoid STS TagSession permission issues
      };

      const result = await this.sts.assumeRole(params).promise();
      
      logger.debug({
        accountId,
        accountAccountId,
        assumedRoleArn: result.AssumedRoleUser.Arn
      }, 'Successfully assumed cross-account role for polling');

      return {
        accessKeyId: result.Credentials.AccessKeyId,
        secretAccessKey: result.Credentials.SecretAccessKey,
        sessionToken: result.Credentials.SessionToken,
        expiration: result.Credentials.Expiration
      };
    } catch (error) {
      logger.error({
        error: error.message,
        roleArn,
        accountAccountId,
        accountId
      }, 'Failed to assume cross-account role for polling');
      throw error;
    }
  }

  /**
   * Create CloudFormation client with assumed role credentials
   * @param {Object} credentials - AWS credentials from assumeRole
   * @param {string} region - AWS region
   * @returns {Object} CloudFormation client
   */
  createCloudFormationClient(credentials, region = config.AWS.REGION) {
    const awsConfig = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      region: region
    };

    return new AWS.CloudFormation(awsConfig);
  }
}

module.exports = CrossAccountService;