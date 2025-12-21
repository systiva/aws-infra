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
                sessionToken: credentials.SessionToken,
            });
            logger.info(
                {
                    mode: this.mode,
                    targetAccountId: this.targetAccountId,
                },
                'DynamoDBService initialized for cross-account operations',
            );
        } else {
            // Admin account mode: Use AWS SDK for direct DynamoDB operations
            this.mode = 'admin-account';
            logger.info(
                {
                    mode: this.mode,
                },
                'DynamoDBService initialized for admin account operations',
            );
        }
    }

    /**
     * Create account entry in public shared table (in account account)
     */
    async createAccountEntryInPublicTable(accountData) {
        if (this.mode !== 'cross-account') {
            throw new Error('This method requires cross-account mode');
        }

        logger.info(
            {
                accountId: accountData.accountId,
                subscriptionTier: 'public',
                targetAccount: this.targetAccountId,
            },
            'Creating account entry in public shared table',
        );

        try {
            // Create account entry in ACCOUNT_PUBLIC table (in account account)
            const accountEntry = {
                PK: `ACCOUNT#${accountData.accountId}`,
                SK: 'init',
                accountId: accountData.accountId,
                accountName: accountData.accountName,
                email: accountData.email,
                createdAt: moment().toISOString(),
                status: 'initialized',
                subscriptionTier: 'public',
                version: '1.0.0',
                lastModified: moment().toISOString(),
            };

            logger.info(
                {
                    accountEntry,
                    tableName:
                        config.DYNAMODB.ACCOUNT_PUBLIC_TABLE || 'ACCOUNT_PUBLIC',
                },
                'Attempting to create account entry with these parameters',
            );

            const tableName =
                config.DYNAMODB.ACCOUNT_PUBLIC_TABLE || 'ACCOUNT_PUBLIC';

            const putParams = {
                TableName: tableName,
                Item: accountEntry,
            };

            logger.info(
                {
                    tableName,
                    targetAccountId: this.targetAccountId,
                    putParams,
                },
                'About to call DynamoDB put operation',
            );

            await this.docClient.put(putParams).promise();

            logger.info(
                {
                    accountId: accountData.accountId,
                    tableName:
                        config.DYNAMODB.ACCOUNT_PUBLIC_TABLE || 'ACCOUNT_PUBLIC',
                },
                'Successfully created account entry in public table',
            );

            return {
                success: true,
                operation: 'CREATE_ACCOUNT_ENTRY',
                accountId: accountData.accountId,
                tableName:
                    config.DYNAMODB.ACCOUNT_PUBLIC_TABLE || 'ACCOUNT_PUBLIC',
                createdAt: accountEntry.createdAt,
            };
        } catch (error) {
            logger.error(
                {
                    error: error.message,
                    errorCode: error.code,
                    errorName: error.name,
                    accountId: accountData.accountId,
                    targetAccount: this.targetAccountId,
                    tableName:
                        config.DYNAMODB.ACCOUNT_PUBLIC_TABLE || 'ACCOUNT_PUBLIC',
                },
                'Failed to create account entry in public table',
            );

            return {
                success: false,
                operation: 'CREATE_ACCOUNT_ENTRY',
                error: `${error.name}: ${error.message}`,
            };
        }
    }

    /**
     * Create dedicated DynamoDB table for private account (in account account)
     */
    async createAccountDynamoDBTable(accountData) {
        if (this.mode !== 'cross-account') {
            throw new Error('This method requires cross-account mode');
        }

        logger.info(
            {
                accountId: accountData.accountId,
                subscriptionTier: 'private',
                targetAccount: this.targetAccountId,
            },
            'Creating dedicated DynamoDB table for private account',
        );

        try {
            // Configure CloudFormation with the cross-account credentials
            const cloudFormation = new AWS.CloudFormation({
                region: config.AWS.REGION,
                accessKeyId: this.credentials.AccessKeyId,
                secretAccessKey: this.credentials.SecretAccessKey,
                sessionToken: this.credentials.SessionToken,
            });

            // Generate CloudFormation template
            const template = this.generateDynamoDBCloudFormationTemplate(
                accountData.accountId,
            );
            const stackName = `account-${accountData.accountId}-dynamodb`;

            // Create CloudFormation stack
            const createStackParams = {
                StackName: stackName,
                TemplateBody: JSON.stringify(template),
                Tags: [
                    {
                        Key: 'AccountId',
                        Value: accountData.accountId,
                    },
                    {
                        Key: 'AccountName',
                        Value: accountData.accountName,
                    },
                    {
                        Key: 'CreatedBy',
                        Value: 'admin-portal-create-infra-worker',
                    },
                    {
                        Key: 'Environment',
                        Value: process.env.NODE_ENV || 'development',
                    },
                ],
            };

            logger.info(
                {
                    stackName,
                    accountId: accountData.accountId,
                },
                'Creating CloudFormation stack for private account table',
            );

            const createStackResult = await cloudFormation
                .createStack(createStackParams)
                .promise();
            const stackId = createStackResult.StackId;

            logger.info(
                {
                    stackId,
                    accountId: accountData.accountId,
                },
                'CloudFormation stack creation initiated for private account',
            );

            // Return immediately without waiting for completion
            // Naming: account-{accountId}-admin-private-{workspace}
            const workspace = process.env.WORKSPACE || 'dev';
            const tableName = `account-${accountData.accountId}-admin-private-${workspace}`;

            return {
                success: true,
                operation: 'CREATE_DYNAMODB_TABLE',
                accountId: accountData.accountId,
                tableName: tableName,
                stackId: stackId,
                status: 'CREATE_IN_PROGRESS',
                createdAt: moment().toISOString(),
            };
        } catch (error) {
            logger.error(
                {
                    error: error.message,
                    accountId: accountData.accountId,
                    targetAccount: this.targetAccountId,
                },
                'Failed to create dedicated DynamoDB table for private account',
            );

            return {
                success: false,
                operation: 'CREATE_DYNAMODB_TABLE',
                error: error.message,
            };
        }
    }

    /**
     * Generate CloudFormation template for account DynamoDB table
     * Naming: account-{accountId}-admin-private-{workspace}
     */
    generateDynamoDBCloudFormationTemplate(accountId) {
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
                                Key: 'Environment',
                                Value: process.env.NODE_ENV || 'development',
                            },
                            {
                                Key: 'ManagedBy',
                                Value: 'admin-portal-create-infra-worker',
                            },
                        ],
                    },
                },
            },
            Outputs: {
                TableName: {
                    Description: 'Name of the created DynamoDB table',
                    Value: {
                        Ref: 'AccountTable',
                    },
                },
                TableArn: {
                    Description: 'ARN of the created DynamoDB table',
                    Value: {
                        'Fn::GetAtt': ['AccountTable', 'Arn'],
                    },
                },
            },
        };
    }

    /**
     * Update account registry with creation status (in admin account)
     */
    async updateAccountInfrastructure(accountId, infrastructureData) {
        if (this.mode !== 'admin-account') {
            throw new Error('This method requires admin-account mode');
        }

        logger.info(
            {
                accountId,
                status: infrastructureData.status,
            },
            'Updating account registry with infrastructure data',
        );

        try {
            // Use raw AWS SDK since the platform-admin table uses pk/sk schema, not Dynamoose
            const adminDocClient = new AWS.DynamoDB.DocumentClient({
                region: config.AWS.REGION,
            });

            const updateData = {
                provisioningState:
                    infrastructureData.status === 'CREATE_COMPLETE'
                        ? 'active'
                        : 'failed',
                lastModified: new Date().toISOString(),
            };

            if (infrastructureData.stackName) {
                updateData.accountTableName = infrastructureData.stackName;
            }
            if (infrastructureData.stackId) {
                updateData.cloudFormationStackId = infrastructureData.stackId;
            }
            if (infrastructureData.createdAt) {
                updateData.provisioningCompletedAt =
                    infrastructureData.createdAt;
            }

            // Build update expression
            const updateExpressionParts = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};

            Object.keys(updateData).forEach((key) => {
                updateExpressionParts.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = updateData[key];
            });

            const params = {
                TableName: config.DYNAMODB.ACCOUNT_REGISTRY_TABLE,
                Key: {
                    PK: `ACCOUNT#${accountId}`,
                    SK: 'METADATA',
                },
                UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW',
            };

            const result = await adminDocClient.update(params).promise();

            logger.info(
                {
                    accountId,
                    updatedFields: Object.keys(updateData),
                },
                'Successfully updated account infrastructure status',
            );

            return {
                success: true,
                updatedItem: result.Attributes,
            };
        } catch (error) {
            logger.error(
                {
                    error: error.message,
                    accountId,
                },
                'Failed to update account infrastructure status',
            );
            throw error;
        }
    }
}

module.exports = DynamoDBService;
