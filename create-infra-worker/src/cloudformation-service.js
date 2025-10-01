const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');
const moment = require('moment');

class CloudFormationService {
  constructor(serviceClients) {
    this.cloudformation = serviceClients.cloudformation;
  }

  /**
   * Create DynamoDB table for private tenant via CloudFormation
   * @param {Object} tenantConfig - Tenant configuration
   * @returns {Object} Stack creation result
   */
  async createTenantDynamoDBTable(tenantConfig) {
    const stackName = `tenant-${tenantConfig.id}-dynamodb`;
    const tableName = `TENANT_${tenantConfig.id}`;
    
    logger.info({
      stackName,
      tableName,
      tenantId: tenantConfig.id
    }, 'Creating CloudFormation stack for tenant DynamoDB table');

    // Generate CloudFormation template for DynamoDB table
    const template = this.generateDynamoDBTemplate(tenantConfig.id);
    
    const stackParams = {
      StackName: stackName,
      TemplateBody: JSON.stringify(template),
      Tags: [
        {
          Key: 'TenantId',
          Value: tenantConfig.id
        },
        {
          Key: 'CreatedBy',
          Value: 'TenantManagementSystem'
        },
        {
          Key: 'Environment',
          Value: process.env.NODE_ENV || 'development'
        },
        {
          Key: 'TenantName', 
          Value: tenantConfig.name || tenantConfig.id
        },
        {
          Key: 'SubscriptionTier',
          Value: 'private'
        }
      ],
      OnFailure: 'ROLLBACK',
      EnableTerminationProtection: false
    };

    try {
      const result = await this.cloudformation.createStack(stackParams).promise();
      
      logger.info({
        stackId: result.StackId,
        stackName,
        tableName,
        tenantId: tenantConfig.id
      }, 'CloudFormation stack for DynamoDB table creation initiated');

      return {
        stackId: result.StackId,
        stackName,
        tableName,
        status: 'CREATE_IN_PROGRESS',
        createdAt: moment().toISOString(),
        templateType: 'dynamodb-only'
      };

    } catch (error) {
      logger.error({
        error: error.message,
        stackName,
        tenantId: tenantConfig.id
      }, 'Failed to create DynamoDB CloudFormation stack');
      throw error;
    }
  }

  /**
   * Generate CloudFormation template for tenant DynamoDB table
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} CloudFormation template
   */
  generateDynamoDBTemplate(tenantId) {
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
                Key: 'CreatedBy',
                Value: 'TenantManagementSystem'
              },
              {
                Key: 'SubscriptionTier',
                Value: 'private'
              }
            ]
          }
        }
      },
      Outputs: {
        TenantTableName: {
          Description: 'Name of the created DynamoDB table',
          Value: {
            Ref: 'TenantTable'
          },
          Export: {
            Name: {
              'Fn::Sub': '${AWS::StackName}-TenantTableName'
            }
          }
        },
        TenantTableArn: {
          Description: 'ARN of the created DynamoDB table',
          Value: {
            'Fn::GetAtt': ['TenantTable', 'Arn']
          },
          Export: {
            Name: {
              'Fn::Sub': '${AWS::StackName}-TenantTableArn'
            }
          }
        }
      }
    };
  }
}

module.exports = CloudFormationService;