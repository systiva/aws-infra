const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');

class CrossAccountService {
  constructor() {
    this.sts = new AWS.STS({ region: config.AWS.REGION });
  }

  /**
   * Assume cross-account role for tenant infrastructure operations
   * @param {string} tenantAccountId - Target tenant account ID
   * @param {string} tenantId - Unique tenant identifier
   * @returns {Object} AWS credentials for assumed role
   */
  async assumeTenantRole(tenantAccountId, tenantId) {
    const roleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.ROLE_NAME}`;
    const sessionName = `${config.CROSS_ACCOUNT.SESSION_NAME}-${tenantId}`;
    
    logger.info({
      roleArn,
      sessionName,
      tenantAccountId,
      tenantId
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
        tenantId,
        tenantAccountId,
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
        tenantAccountId,
        tenantId
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