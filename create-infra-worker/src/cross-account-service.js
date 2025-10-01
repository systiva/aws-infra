const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');

class CrossAccountService {
  constructor() {
    // STS service for cross-account role assumption (outside VPC)
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
    const sessionName = `TenantInfraWorker-${tenantId}-${Date.now()}`;
    
    logger.info({
      roleArn,
      sessionName,
      tenantAccountId,
      tenantId
    }, 'Attempting to assume cross-account role');

    try {
      const params = {
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: config.CROSS_ACCOUNT.ASSUME_ROLE_DURATION
      };

      const result = await this.sts.assumeRole(params).promise();
      
      logger.info({
        tenantId,
        tenantAccountId,
        assumedRoleArn: result.AssumedRoleUser.Arn
      }, 'Successfully assumed cross-account role');

      return result.Credentials; // Return the credentials object directly
    } catch (error) {
      logger.error({
        error: error.message,
        roleArn,
        tenantAccountId,
        tenantId,
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