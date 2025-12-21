const AWS = require('aws-sdk');
const config = require('../config');
const logger = require('../logger');
const moment = require('moment');

class CloudFormationService {
    constructor(serviceClients) {
        this.cloudformation = serviceClients.cloudformation;
    }

    /**
     * Create DynamoDB table for private account via CloudFormation
     * Naming: account-{accountId}-admin-private-{workspace}
     * @param {Object} accountConfig - Account configuration
     * @returns {Object} Stack creation result
     */
    async createAccountDynamoDBTable(accountConfig) {
        const workspace = process.env.WORKSPACE || 'dev';
        const stackName = `account-${accountConfig.id}-dynamodb`;
        const tableName = `account-${accountConfig.id}-admin-private-${workspace}`;

        logger.info(
            {
                stackName,
                tableName,
                accountId: accountConfig.id,
            },
            'Creating CloudFormation stack for account DynamoDB table',
        );

        // Generate CloudFormation template for DynamoDB table
        const template = this.generateDynamoDBTemplate(accountConfig.id);

        const stackParams = {
            StackName: stackName,
            TemplateBody: JSON.stringify(template),
            Tags: [
                {
                    Key: 'AccountId',
                    Value: accountConfig.id,
                },
                {
                    Key: 'CreatedBy',
                    Value: 'AccountManagementSystem',
                },
                {
                    Key: 'Environment',
                    Value: process.env.NODE_ENV || 'development',
                },
                {
                    Key: 'AccountName',
                    Value: accountConfig.name || accountConfig.id,
                },
                {
                    Key: 'SubscriptionTier',
                    Value: 'private',
                },
            ],
            OnFailure: 'ROLLBACK',
            EnableTerminationProtection: false,
        };

        try {
            const result = await this.cloudformation
                .createStack(stackParams)
                .promise();

            logger.info(
                {
                    stackId: result.StackId,
                    stackName,
                    tableName,
                    accountId: accountConfig.id,
                },
                'CloudFormation stack for DynamoDB table creation initiated',
            );

            return {
                stackId: result.StackId,
                stackName,
                tableName,
                status: 'CREATE_IN_PROGRESS',
                createdAt: moment().toISOString(),
                templateType: 'dynamodb-only',
            };
        } catch (error) {
            logger.error(
                {
                    error: error.message,
                    stackName,
                    accountId: accountConfig.id,
                },
                'Failed to create DynamoDB CloudFormation stack',
            );
            throw error;
        }
    }

    /**
     * Generate CloudFormation template for account DynamoDB table
     * Naming: account-{accountId}-admin-private-{workspace}
     * @param {string} accountId - Account identifier
     * @returns {Object} CloudFormation template
     */
    generateDynamoDBTemplate(accountId) {
        const workspace = process.env.WORKSPACE || 'dev';
        const tableName = `account-${accountId}-admin-private-${workspace}`;

        return {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: `DynamoDB table for account ${accountId}`,
            Resources: {
                AccountTable: {
                    Type: 'AWS::DynamoDB::Table',
                    Properties: {
                        TableName: tableName,
                        AttributeDefinitions: [
                            {
                                AttributeName: 'pk',
                                AttributeType: 'S',
                            },
                            {
                                AttributeName: 'sk',
                                AttributeType: 'S',
                            },
                        ],
                        KeySchema: [
                            {
                                AttributeName: 'pk',
                                KeyType: 'HASH',
                            },
                            {
                                AttributeName: 'sk',
                                KeyType: 'RANGE',
                            },
                        ],
                        BillingMode: 'PAY_PER_REQUEST',
                        PointInTimeRecoverySpecification: {
                            PointInTimeRecoveryEnabled: true,
                        },
                        SSESpecification: {
                            SSEEnabled: true,
                        },
                        Tags: [
                            {
                                Key: 'AccountId',
                                Value: accountId,
                            },
                            {
                                Key: 'CreatedBy',
                                Value: 'AccountManagementSystem',
                            },
                            {
                                Key: 'SubscriptionTier',
                                Value: 'private',
                            },
                        ],
                    },
                },
            },
            Outputs: {
                AccountTableName: {
                    Description: 'Name of the created DynamoDB table',
                    Value: {
                        Ref: 'AccountTable',
                    },
                    Export: {
                        Name: {
                            'Fn::Sub': '${AWS::StackName}-AccountTableName',
                        },
                    },
                },
                AccountTableArn: {
                    Description: 'ARN of the created DynamoDB table',
                    Value: {
                        'Fn::GetAtt': ['AccountTable', 'Arn'],
                    },
                    Export: {
                        Name: {
                            'Fn::Sub': '${AWS::StackName}-AccountTableArn',
                        },
                    },
                },
            },
        };
    }
}

module.exports = CloudFormationService;
