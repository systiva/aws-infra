const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');

// Configure AWS SDK to use VPC endpoints when in private subnet
AWS.config.update({
  region: config.AWS.REGION,
  maxRetries: 3,
  retryDelayOptions: {
    customBackoff: function(retryCount) {
      return Math.pow(2, retryCount) * 100;
    }
  }
});

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
    }, 'Assuming cross-account role for deletion');

    try {
      const params = {
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: config.CROSS_ACCOUNT.ASSUME_ROLE_DURATION
        // Removed Tags to avoid sts:TagSession permission requirement
      };

      const result = await this.sts.assumeRole(params).promise();
      
      logger.info({
        accountId,
        accountAccountId,
        assumedRoleArn: result.AssumedRoleUser.Arn
      }, 'Successfully assumed cross-account role for deletion');

      return result.Credentials; // Return the credentials object directly
    } catch (error) {
      logger.error({
        error: error.message,
        roleArn,
        accountAccountId,
        accountId
      }, 'Failed to assume cross-account role for deletion');
      throw error;
    }
  }

  /**
   * Create AWS service clients with assumed role credentials
   * @param {Object} credentials - AWS credentials from assumeRole
   * @param {string} region - AWS region
   * @returns {Object} AWS service clients
   */
  createServiceClients(credentials, region = config.AWS.REGION) {
    const awsConfig = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      region: region
    };

    return {
      cloudformation: new AWS.CloudFormation(awsConfig),
      s3: new AWS.S3(awsConfig),
      ec2: new AWS.EC2(awsConfig),
      rds: new AWS.RDS(awsConfig),
      iam: new AWS.IAM(awsConfig)
    };
  }
}

module.exports = CrossAccountService;