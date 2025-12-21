const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');

class CrossAccountService {
  constructor() {
    // STS service for cross-account role assumption (outside VPC)
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
    const sessionName = `AccountInfraWorker-${accountId}-${Date.now()}`;
    
    logger.info({
      roleArn,
      sessionName,
      accountAccountId,
      accountId
    }, 'Attempting to assume cross-account role');

    try {
      const params = {
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: config.CROSS_ACCOUNT.ASSUME_ROLE_DURATION
      };

      const result = await this.sts.assumeRole(params).promise();
      
      logger.info({
        accountId,
        accountAccountId,
        assumedRoleArn: result.AssumedRoleUser.Arn
      }, 'Successfully assumed cross-account role');

      return result.Credentials; // Return the credentials object directly
    } catch (error) {
      logger.error({
        error: error.message,
        roleArn,
        accountAccountId,
        accountId,
        errorCode: error.code
      }, 'Failed to assume cross-account role');
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
      dynamodb: new AWS.DynamoDB(awsConfig),
      docClient: new AWS.DynamoDB.DocumentClient(awsConfig),
      s3: new AWS.S3(awsConfig),
      ec2: new AWS.EC2(awsConfig),
      iam: new AWS.IAM(awsConfig)
    };
  }
}

module.exports = CrossAccountService;