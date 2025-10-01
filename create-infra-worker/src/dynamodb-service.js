const AWS = require('aws-sdk');
const logger = require('../logger');
const config = require('../config');
const moment = require('moment');

class DynamoDBService {
  constructor(credentials = null, targetAccountId = null) {
    if (credentials && targetAccountId) {
      // Cross-account mode: Use raw AWS SDK with provided credentials (like old repo)
      this.mode = 'cross-account';
      this.targetAccountId = targetAccountId;
      this.credentials = credentials; // Store credentials for later use
      this.docClient = new AWS.DynamoDB.DocumentClient({
        region: config.AWS.REGION,
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken
      });
      logger.info({
        mode: this.mode,
        targetAccountId: this.targetAccountId
      }, 'DynamoDBService initialized for cross-account operations');
    } else {
      // Admin account mode: Use AWS SDK for direct DynamoDB operations
      this.mode = 'admin-account';
      logger.info({
        mode: this.mode
      }, 'DynamoDBService initialized for admin account operations');
    }
  }

  /**
   * Create tenant entry in public shared table (in tenant account)
   */
  async createTenantEntryInPublicTable(tenantData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      tenantId: tenantData.tenantId,
      subscriptionTier: 'public',
      targetAccount: this.targetAccountId
    }, 'Creating tenant entry in public shared table');

    try {
      // Create tenant entry in TENANT_PUBLIC table (in tenant account)
      const tenantEntry = {
        pk: `TENANT#${tenantData.tenantId}`,
        sk: 'init',
        tenantId: tenantData.tenantId,
        tenantName: tenantData.tenantName,
        email: tenantData.email,
        createdAt: moment().toISOString(),
        status: 'initialized',
        subscriptionTier: 'public',
        version: '1.0.0',
        lastModified: moment().toISOString()
      };

      logger.info({
        tenantEntry,
        tableName: config.DYNAMODB.TENANT_PUBLIC_TABLE || 'TENANT_PUBLIC'
      }, 'Attempting to create tenant entry with these parameters');

      const tableName = config.DYNAMODB.TENANT_PUBLIC_TABLE || 'TENANT_PUBLIC';
      
      const putParams = {
        TableName: tableName,
        Item: tenantEntry
      };

      logger.info({
        tableName,
        targetAccountId: this.targetAccountId,
        putParams
      }, 'About to call DynamoDB put operation');

      await this.docClient.put(putParams).promise();
      
      logger.info({
        tenantId: tenantData.tenantId,
        tableName: config.DYNAMODB.TENANT_PUBLIC_TABLE || 'TENANT_PUBLIC'
      }, 'Successfully created tenant entry in public table');

      return {
        success: true,
        operation: 'CREATE_TENANT_ENTRY',
        tenantId: tenantData.tenantId,
        tableName: config.DYNAMODB.TENANT_PUBLIC_TABLE || 'TENANT_PUBLIC',
        createdAt: tenantEntry.createdAt
      };

    } catch (error) {
      logger.error({
        error: error.message,
        errorCode: error.code,
        errorName: error.name,
        tenantId: tenantData.tenantId,
        targetAccount: this.targetAccountId,
        tableName: config.DYNAMODB.TENANT_PUBLIC_TABLE || 'TENANT_PUBLIC'
      }, 'Failed to create tenant entry in public table');

      return {
        success: false,
        operation: 'CREATE_TENANT_ENTRY',
        error: `${error.name}: ${error.message}`
      };
    }
  }

  /**
   * Create dedicated DynamoDB table for private tenant (in tenant account)
   */
  async createTenantDynamoDBTable(tenantData) {
    if (this.mode !== 'cross-account') {
      throw new Error('This method requires cross-account mode');
    }

    logger.info({
      tenantId: tenantData.tenantId,
      subscriptionTier: 'private',
      targetAccount: this.targetAccountId
    }, 'Creating dedicated DynamoDB table for private tenant');

    try {
      // Configure CloudFormation with the cross-account credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.AWS.REGION,
        accessKeyId: this.credentials.AccessKeyId,
        secretAccessKey: this.credentials.SecretAccessKey,
        sessionToken: this.credentials.SessionToken
      });

      // Generate CloudFormation template
      const template = this.generateDynamoDBCloudFormationTemplate(tenantData.tenantId);
      const stackName = `tenant-${tenantData.tenantId}-dynamodb`;
      
      // Create CloudFormation stack
      const createStackParams = {
        StackName: stackName,
        TemplateBody: JSON.stringify(template),
        Tags: [
          {
            Key: 'TenantId',
            Value: tenantData.tenantId
          },
          {
            Key: 'TenantName',
            Value: tenantData.tenantName
          },
          {
            Key: 'CreatedBy',
            Value: 'admin-portal-create-infra-worker'
          },
          {
            Key: 'Environment',
            Value: process.env.NODE_ENV || 'development'
          }
        ]
      };

      logger.info({
        stackName,
        tenantId: tenantData.tenantId
      }, 'Creating CloudFormation stack for private tenant table');

      const createStackResult = await cloudFormation.createStack(createStackParams).promise();
      const stackId = createStackResult.StackId;

      logger.info({
        stackId,
        tenantId: tenantData.tenantId
      }, 'CloudFormation stack creation initiated for private tenant');

      // Return immediately without waiting for completion
      const tableName = `TENANT_${tenantData.tenantId}`;

      return {
        success: true,
        operation: 'CREATE_DYNAMODB_TABLE',
        tenantId: tenantData.tenantId,
        tableName: tableName,
        stackId: stackId,
        status: 'CREATE_IN_PROGRESS',
        createdAt: moment().toISOString()
      };

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId: tenantData.tenantId,
        targetAccount: this.targetAccountId
      }, 'Failed to create dedicated DynamoDB table for private tenant');

      return {
        success: false,
        operation: 'CREATE_DYNAMODB_TABLE',
        error: error.message
      };
    }
  }

  /**
   * Generate CloudFormation template for tenant DynamoDB table
   */
  generateDynamoDBCloudFormationTemplate(tenantId) {
    const tableName = `TENANT_${tenantId}`;
    
    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `DynamoDB table for tenant ${tenantId}`,
      Resources: {
        TenantTable: {
          Type: 'AWS::DynamoDB::Table',
          Properties: {
            TableName: tableName,
            AttributeDefinitions: [
              {
                AttributeName: 'pk',
                AttributeType: 'S'
              },
              {
                AttributeName: 'sk',
                AttributeType: 'S'
              }
            ],
            KeySchema: [
              {
                AttributeName: 'pk',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'sk',
                KeyType: 'RANGE'
              }
            ],
            BillingMode: 'PAY_PER_REQUEST',
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true
            },
            SSESpecification: {
              SSEEnabled: true
            },
            Tags: [
              {
                Key: 'TenantId',
                Value: tenantId
              },
              {
                Key: 'Environment',
                Value: process.env.NODE_ENV || 'development'
              },
              {
                Key: 'ManagedBy',
                Value: 'admin-portal-create-infra-worker'
              }
            ]
          }
        }
      },
      Outputs: {
        TableName: {
          Description: 'Name of the created DynamoDB table',
          Value: {
            Ref: 'TenantTable'
          }
        },
        TableArn: {
          Description: 'ARN of the created DynamoDB table',
          Value: {
            'Fn::GetAtt': ['TenantTable', 'Arn']
          }
        }
      }
    };
  }

  /**
   * Update tenant registry with creation status (in admin account)
   */
  async updateTenantInfrastructure(tenantId, infrastructureData) {
    if (this.mode !== 'admin-account') {
      throw new Error('This method requires admin-account mode');
    }

    logger.info({
      tenantId,
      status: infrastructureData.status
    }, 'Updating tenant registry with infrastructure data');

    try {
      // Use raw AWS SDK since the platform-admin table uses pk/sk schema, not Dynamoose
      const adminDocClient = new AWS.DynamoDB.DocumentClient({
        region: config.AWS.REGION
      });

      const updateData = {
        provisioningState: infrastructureData.status === 'CREATE_COMPLETE' ? 'active' : 'failed',
        lastModified: new Date().toISOString()
      };

      if (infrastructureData.stackName) {
        updateData.tenantTableName = infrastructureData.stackName;
      }
      if (infrastructureData.stackId) {
        updateData.cloudFormationStackId = infrastructureData.stackId;
      }
      if (infrastructureData.createdAt) {
        updateData.provisioningCompletedAt = infrastructureData.createdAt;
      }

      // Build update expression
      const updateExpressionParts = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updateData).forEach(key => {
        updateExpressionParts.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updateData[key];
      });

      const params = {
        TableName: config.DYNAMODB.TENANT_REGISTRY_TABLE,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: 'METADATA'
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      };

      const result = await adminDocClient.update(params).promise();

      logger.info({
        tenantId,
        updatedFields: Object.keys(updateData)
      }, 'Successfully updated tenant infrastructure status');

      return {
        success: true,
        updatedItem: result.Attributes
      };

    } catch (error) {
      logger.error({
        error: error.message,
        tenantId
      }, 'Failed to update tenant infrastructure status');
      throw error;
    }
  }
}

module.exports = DynamoDBService;