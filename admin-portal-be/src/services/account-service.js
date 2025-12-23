const Commons = require('../utils/commons/common-utilities');
const Constants = require('../../constant');
const Logger = require('../../logger');
const InternalError = require('../utils/error/internal-error');
const config = require('../../config');
const Mapping = require('../db/access-patterns/mapping');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

class AccountService {

  /**
   * Get all accounts from DynamoDB with total count
   */
  static async getAllAccounts() {
    Logger.debug('AccountService.getAllAccounts - Starting to retrieve all accounts');

    try {
      // Scan all accounts from DynamoDB
      const accounts = await Mapping.scanAccounts();
      Logger.debug({ count: accounts.length }, 'AccountService.getAllAccounts - Retrieved accounts count');

      const response = {
        accounts: accounts,
        totalCount: accounts.length,
        timestamp: moment().toISOString()
      };

      Logger.debug(response, 'AccountService.getAllAccounts - Response prepared');

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Accounts retrieved successfully',
        response
      );

    } catch (error) {
      Logger.error(error, 'AccountService.getAllAccounts - Error occurred');
      throw new InternalError(`Failed to retrieve accounts: ${error.message}`);
    }
  }

  /**
   * Get individual account details by ID
   */
  static async getAccountDetails(accountId) {
    Logger.debug({ accountId }, 'AccountService.getAccountDetails - Getting account details');

    try {
      const account = await Mapping.getAccount(accountId);
      if (!account) {
        Logger.warn({ accountId }, 'AccountService.getAccountDetails - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId }
        );
      }

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Account details retrieved successfully',
        account
      );

    } catch (error) {
      Logger.error(error, 'AccountService.getAccountDetails - Error occurred');
      throw new InternalError(`Failed to get account details: ${error.message}`);
    }
  }

  /**
   * Create a new account in DynamoDB
   */
  static async createAccount(accountData) {
    Logger.debug(accountData, 'AccountService.createAccount - Creating account with data');

    try {
      // Validate required fields
      const requiredFields = ['accountName', 'email', 'subscriptionTier', 'firstName', 'lastName', 'adminUsername', 'adminEmail'];
      for (const field of requiredFields) {
        if (!accountData[field]) {
          throw new InternalError(`Missing required field: ${field}`);
        }
      }

      // Validate subscription tier values
      const validSubscriptionTiers = ['public', 'private'];
      if (!validSubscriptionTiers.includes(accountData.subscriptionTier)) {
        throw new InternalError(`Invalid subscription tier. Must be one of: ${validSubscriptionTiers.join(', ')}`);
      }

      // Generate simple 8-character account ID (YYYYMMDD or YYMMDDHH format)
      let accountId = moment().format('YYYYMMDD');

      // Check if account with this ID already exists
      let existingAccountById = await Mapping.getAccount(accountId);

      // If exists, use YYMMDDHH format to keep it 8 characters
      if (existingAccountById) {
        accountId = moment().format('YYMMDDHH');
        existingAccountById = await Mapping.getAccount(accountId);

        // If still exists, add random 2-digit suffix
        if (existingAccountById) {
          const randomSuffix = Math.floor(Math.random() * 99).toString().padStart(2, '0');
          accountId = moment().format('YYMMDD') + randomSuffix;
        }
      }

      // Prepare account object
      const account = {
        accountId: accountId,
        accountName: accountData.accountName,
        email: accountData.email,
        firstName: accountData.firstName,
        lastName: accountData.lastName,
        adminUsername: accountData.adminUsername, // Username for Cognito login
        adminEmail: accountData.adminEmail,
        adminPassword: accountData.adminPassword, // Optional, will be filtered if undefined
        subscriptionTier: accountData.subscriptionTier,
        provisioningState: 'creating',
        registeredOn: moment().toISOString(),
        createdBy: accountData.createdBy || 'system',
        lastModified: moment().toISOString()
      };

      Logger.debug(account, 'AccountService.createAccount - Prepared account object');

      // Check if account with same account name already exists
      const existingAccount = await Mapping.getAccountByName(accountData.accountName);
      if (existingAccount) {
        Logger.warn({ accountName: accountData.accountName }, 'AccountService.createAccount - Account already exists');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Account with this name already exists',
          { existingAccountId: existingAccount.accountId }
        );
      }

      // Save account to DynamoDB with 'creating' status
      await Mapping.createAccount(account);
      Logger.debug({ accountId }, 'AccountService.createAccount - Account created in DynamoDB with creating status');

      // Start Step Functions workflow for account provisioning
      try {
        const accountAccountId = config.CROSS_ACCOUNT.ACCOUNT_ACCOUNT_ID;

        // Start Step Functions execution for account creation
        const stepFunctionsResult = await this.startAccountCreationWorkflow(account, accountAccountId);

        // Update account with Step Functions execution info
        const updateData = {
          stepFunctionExecutionArn: stepFunctionsResult.executionArn,
          accountAccountId: accountAccountId,
          subscriptionTier: accountData.subscriptionTier,
          provisioningState: 'creating',
          stepFunctionStatus: {
            executionStatus: 'RUNNING',
            lastChecked: moment().toISOString()
          },
          lastModified: moment().toISOString(),
          provisioningSubmittedAt: moment().toISOString()
        };

        // Set expected table name based on subscription tier
        if (accountData.subscriptionTier === 'private') {
          updateData.accountTableName = `ACCOUNT_${accountId}`;
        } else {
          updateData.accountTableName = 'ACCOUNT_PUBLIC';
        }

        await Mapping.updateAccount(accountId, updateData);

        // Update local account object for response
        Object.assign(account, updateData);

        Logger.debug({
          accountId,
          subscriptionTier: accountData.subscriptionTier,
          executionArn: stepFunctionsResult.executionArn,
          tableName: updateData.accountTableName
        }, 'AccountService.createAccount - Step Functions workflow started successfully');

      } catch (provisioningError) {
        Logger.error(provisioningError, 'AccountService.createAccount - Error starting Step Functions workflow');

        // Update account status to 'failed' if Step Functions fails
        await Mapping.updateAccount(accountId, {
          provisioningState: 'failed',
          provisioningError: provisioningError.message,
          lastModified: moment().toISOString()
        });

        account.provisioningState = 'failed';
        account.provisioningError = provisioningError.message;

        // Return the account with failed status rather than throwing error
        return Commons.getRes(
          Constants.HTTP_STATUS.CREATED,
          'Account created but provisioning failed',
          account
        );
      }

      Logger.debug({ accountId, subscriptionTier: accountData.subscriptionTier }, 'AccountService.createAccount - Account onboarding workflow started');

      return Commons.getRes(
        Constants.HTTP_STATUS.CREATED,
        'Account created successfully',
        account
      );

    } catch (error) {
      Logger.error(error, 'AccountService.createAccount - Error occurred');
      throw new InternalError(`Failed to create account: ${error.message}`);
    }
  }

  /**
   * Start Step Functions workflow for account creation
   */
  static async startAccountCreationWorkflow(account, accountAccountId) {
    Logger.debug({ accountId: account.accountId, subscriptionTier: account.subscriptionTier }, 'AccountService.startAccountCreationWorkflow - Starting workflow');

    try {
      const stepfunctions = new AWS.StepFunctions({
        region: config.AWS_REGION
      });

      const input = {
        operation: 'CREATE',
        accountId: account.accountId,
        accountAccountId: accountAccountId,
        subscriptionTier: account.subscriptionTier,
        accountName: account.accountName,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        adminUsername: account.adminUsername,
        adminEmail: account.adminEmail,
        adminPassword: account.adminPassword,
        createdBy: account.createdBy,
        registeredOn: account.registeredOn
      };

      const params = {
        stateMachineArn: config.STEP_FUNCTIONS.CREATE_ACCOUNT_STATE_MACHINE_ARN,
        input: JSON.stringify(input),
        name: `create-account-${account.accountId}-${Date.now()}`
      };

      const result = await stepfunctions.startExecution(params).promise();

      Logger.debug({
        accountId: account.accountId,
        executionArn: result.executionArn
      }, 'AccountService.startAccountCreationWorkflow - Workflow started successfully');

      return result;

    } catch (error) {
      Logger.error(error, 'AccountService.startAccountCreationWorkflow - Error occurred');
      throw error;
    }
  }

  /**
   * Start Step Functions workflow for account deletion
   */
  static async startAccountDeletionWorkflow(account, accountAccountId) {
    Logger.debug({ accountId: account.accountId, subscriptionTier: account.subscriptionTier }, 'AccountService.startAccountDeletionWorkflow - Starting workflow');

    try {
      const stepfunctions = new AWS.StepFunctions({
        region: config.AWS_REGION
      });

      const input = {
        operation: 'DELETE',
        accountId: account.accountId,
        accountAccountId: accountAccountId,
        subscriptionTier: account.subscriptionTier,
        accountName: account.accountName,
        email: account.email,
        deletedBy: 'admin-portal',
        deletedOn: moment().toISOString()
      };

      // For private accounts, include stackId if available
      if (account.subscriptionTier === 'private') {
        if (account.cloudFormationStackId) {
          input.stackId = account.cloudFormationStackId;
          Logger.debug({
            accountId: account.accountId,
            stackId: account.cloudFormationStackId
          }, 'AccountService.startAccountDeletionWorkflow - Including stackId for private account');
        } else {
          // Generate expected stack name if stackId is not available
          input.stackId = `account-${account.accountId}-dynamodb`;
          Logger.debug({
            accountId: account.accountId,
            stackId: input.stackId
          }, 'AccountService.startAccountDeletionWorkflow - Generated stackId for private account (no cloudFormationStackId found)');
        }
      }

      const params = {
        stateMachineArn: config.STEP_FUNCTIONS.DELETE_ACCOUNT_STATE_MACHINE_ARN,
        input: JSON.stringify(input),
        name: `delete-account-${account.accountId}-${Date.now()}`
      };

      Logger.debug({
        accountId: account.accountId,
        subscriptionTier: account.subscriptionTier,
        stepFunctionsInput: input
      }, 'AccountService.startAccountDeletionWorkflow - Step Functions input prepared');

      const result = await stepfunctions.startExecution(params).promise();

      Logger.debug({
        accountId: account.accountId,
        executionArn: result.executionArn
      }, 'AccountService.startAccountDeletionWorkflow - Workflow started successfully');

      return result;

    } catch (error) {
      Logger.error(error, 'AccountService.startAccountDeletionWorkflow - Error occurred');
      throw error;
    }
  }

  /**
   * Check Step Functions execution status
   */
  static async checkStepFunctionStatus(executionArn) {
    Logger.debug({ executionArn }, 'AccountService.checkStepFunctionStatus - Checking execution status');

    try {
      const stepfunctions = new AWS.StepFunctions({
        region: config.AWS_REGION
      });

      const params = {
        executionArn: executionArn
      };

      const result = await stepfunctions.describeExecution(params).promise();

      const statusInfo = {
        status: result.status,
        startDate: result.startDate,
        stopDate: result.stopDate,
        input: JSON.parse(result.input),
        lastChecked: moment().toISOString()
      };

      // Include output if execution is complete
      if (result.output) {
        try {
          statusInfo.output = JSON.parse(result.output);
        } catch (parseError) {
          statusInfo.output = result.output;
        }
      }

      // Include error details if execution failed
      if (result.status === 'FAILED' && result.output) {
        try {
          const errorOutput = JSON.parse(result.output);
          statusInfo.error = errorOutput.Error || errorOutput.Cause || 'Unknown error';
        } catch (parseError) {
          statusInfo.error = result.output;
        }
      }

      Logger.debug({
        executionArn,
        status: result.status,
        startDate: result.startDate,
        stopDate: result.stopDate
      }, 'AccountService.checkStepFunctionStatus - Execution status retrieved');

      return statusInfo;

    } catch (error) {
      Logger.error(error, 'AccountService.checkStepFunctionStatus - Error occurred');
      throw error;
    }
  }

  /**
   * Update existing account in DynamoDB
   */
  static async updateAccount(accountData) {
    Logger.debug(accountData, 'AccountService.updateAccount - Updating account with data');

    try {
      // Validate account ID
      if (!accountData.accountId) {
        throw new InternalError('Missing required field: accountId');
      }

      // Validate subscription tier if provided
      if (accountData.subscriptionTier) {
        const validSubscriptionTiers = ['public', 'private'];
        if (!validSubscriptionTiers.includes(accountData.subscriptionTier)) {
          throw new InternalError(`Invalid subscription tier. Must be one of: ${validSubscriptionTiers.join(', ')}`);
        }
      }

      // Check if account exists
      const existingAccount = await Mapping.getAccount(accountData.accountId);
      if (!existingAccount) {
        Logger.warn({ accountId: accountData.accountId }, 'AccountService.updateAccount - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId: accountData.accountId }
        );
      }

      // Prepare update data
      const updateData = {
        ...existingAccount,
        ...accountData,
        lastModified: moment().toISOString()
      };

      // Don't allow updating certain fields
      delete updateData.accountId;
      delete updateData.registeredOn;
      delete updateData.createdBy;

      Logger.debug(updateData, 'AccountService.updateAccount - Prepared update data');

      // Update account in DynamoDB
      const updatedAccount = await Mapping.updateAccount(accountData.accountId, updateData);
      Logger.debug({ accountId: accountData.accountId }, 'AccountService.updateAccount - Account updated in DynamoDB');

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Account updated successfully',
        updatedAccount
      );

    } catch (error) {
      Logger.error(error, 'AccountService.updateAccount - Error occurred');
      throw new InternalError(`Failed to update account: ${error.message}`);
    }
  }

  /**
   * Delete account from DynamoDB and handle subscription tier specific cleanup
   */
  static async deleteAccount(accountId) {
    Logger.debug({ accountId }, 'AccountService.deleteAccount - Deleting account');

    try {
      // Validate account ID
      if (!accountId) {
        throw new InternalError('Account ID is required');
      }

      // Check if account exists
      const existingAccount = await Mapping.getAccount(accountId);
      if (!existingAccount) {
        Logger.warn({ accountId }, 'AccountService.deleteAccount - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId }
        );
      }

      // Update account status to 'deleting' before actual deletion
      await Mapping.updateAccount(accountId, {
        provisioningState: 'deleting',
        lastModified: moment().toISOString()
      });
      Logger.debug({ accountId }, 'AccountService.deleteAccount - Account status updated to deleting');

      // Start Step Functions workflow for account deletion
      try {
        const accountAccountId = config.CROSS_ACCOUNT.ACCOUNT_ACCOUNT_ID;

        // Start Step Functions execution for account deletion
        const stepFunctionsResult = await this.startAccountDeletionWorkflow(existingAccount, accountAccountId);

        // Update account with Step Functions execution info
        const updateData = {
          stepFunctionExecutionArn: stepFunctionsResult.executionArn,
          provisioningState: 'deleting',
          stepFunctionStatus: {
            executionStatus: 'RUNNING',
            lastChecked: moment().toISOString()
          },
          lastModified: moment().toISOString(),
          deletionSubmittedAt: moment().toISOString()
        };

        await Mapping.updateAccount(accountId, updateData);

        Logger.debug({
          accountId,
          subscriptionTier: existingAccount.subscriptionTier,
          executionArn: stepFunctionsResult.executionArn
        }, 'AccountService.deleteAccount - Step Functions deletion workflow started successfully');

        return Commons.getRes(
          Constants.HTTP_STATUS.OK,
          'Account deletion initiated successfully',
          {
            accountId,
            subscriptionTier: existingAccount.subscriptionTier,
            deletedAt: moment().toISOString(),
            executionArn: stepFunctionsResult.executionArn,
            organizationName: existingAccount.organizationName,
            note: 'Step Functions deletion workflow initiated asynchronously'
          }
        );

      } catch (deletionError) {
        Logger.error(deletionError, 'AccountService.deleteAccount - Error starting Step Functions deletion workflow');

        // Update account status to 'deletion_failed' if Step Functions fails
        await Mapping.updateAccount(accountId, {
          provisioningState: 'deletion_failed',
          provisioningError: deletionError.message,
          lastModified: moment().toISOString()
        });

        // Return error status rather than throwing exception
        return Commons.getRes(
          Constants.HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'Account deletion workflow failed to start',
          {
            accountId,
            error: deletionError.message,
            deletionFailedAt: moment().toISOString()
          }
        );
      }

    } catch (error) {
      Logger.error(error, 'AccountService.deleteAccount - Error occurred');
      throw new InternalError(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Suspend account by setting provisioningState to 'inactive'
   */
  static async suspendAccount(accountId) {
    Logger.debug({ accountId }, 'AccountService.suspendAccount - Suspending account');

    try {
      // Validate account ID
      if (!accountId) {
        throw new InternalError('Account ID is required');
      }

      // Check if account exists
      const existingAccount = await Mapping.getAccount(accountId);
      if (!existingAccount) {
        Logger.warn({ accountId }, 'AccountService.suspendAccount - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId }
        );
      }

      // Check if account is already inactive
      if (existingAccount.provisioningState === 'inactive') {
        Logger.warn({ accountId }, 'AccountService.suspendAccount - Account already suspended');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Account is already suspended',
          existingAccount
        );
      }

      // Update account status to 'inactive'
      const updateData = {
        provisioningState: 'inactive',
        lastModified: moment().toISOString(),
        suspendedAt: moment().toISOString()
      };

      const updatedAccount = await Mapping.updateAccount(accountId, updateData);
      Logger.debug({ accountId }, 'AccountService.suspendAccount - Account suspended successfully');

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Account suspended successfully',
        updatedAccount
      );

    } catch (error) {
      Logger.error(error, 'AccountService.suspendAccount - Error occurred');
      throw new InternalError(`Failed to suspend account: ${error.message}`);
    }
  }

  /**
   * Create account entry in existing ACCOUNT_PUBLIC table in account account
   */
  static async createAccountEntryInPublicTable(accountId, accountAccountId) {
    Logger.debug({ accountId, accountAccountId }, 'AccountService.createAccountEntryInPublicTable - Creating entry in ACCOUNT_PUBLIC table');

    try {
      // Configure STS to assume role in account account
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      // Assume role in account account
      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `AccountEntry-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      Logger.debug(assumeRoleParams, 'AccountService.createAccountEntryInPublicTable - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      // Create account entry in ACCOUNT_PUBLIC table
      const accountEntry = {
        PK: `ACCOUNT#${accountId}`,
        SK: 'init',
        accountId: accountId,
        createdAt: moment().toISOString(),
        status: 'initialized',
        subscriptionTier: 'public',
        version: '1.0.0',
        lastModified: moment().toISOString()
      };

      const putParams = {
        TableName: 'ACCOUNT_PUBLIC',
        Item: accountEntry,
        // Ensure we don't overwrite existing entries
        ConditionExpression: 'attribute_not_exists(PK)'
      };

      await dynamodb.put(putParams).promise();
      Logger.debug({ accountId, tableName: 'ACCOUNT_PUBLIC' }, 'AccountService.createAccountEntryInPublicTable - Account entry created successfully');

      return {
        tableName: 'ACCOUNT_PUBLIC',
        accountEntry: accountEntry,
        status: 'COMPLETED'
      };

    } catch (error) {
      Logger.error(error, 'AccountService.createAccountEntryInPublicTable - Error occurred');
      throw new InternalError(`Failed to create account entry in ACCOUNT_PUBLIC table: ${error.message}`);
    }
  }

  /**
   * Generate CloudFormation template for account DynamoDB table
   */
  static generateDynamoDBCloudFormationTemplate(accountId) {
    const tableName = `ACCOUNT_${accountId}`;

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
                AttributeName: 'PK',
                AttributeType: 'S'
              },
              {
                AttributeName: 'SK',
                AttributeType: 'S'
              }
            ],
            KeySchema: [
              {
                AttributeName: 'PK',
                KeyType: 'HASH'
              },
              {
                AttributeName: 'SK',
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
                Key: 'AccountId',
                Value: accountId
              },
              {
                Key: 'Environment',
                Value: process.env.NODE_ENV || 'development'
              },
              {
                Key: 'ManagedBy',
                Value: 'AccountManagementSystem'
              }
            ]
          }
        }
      },
      Outputs: {
        TableName: {
          Description: 'Name of the created DynamoDB table',
          Value: {
            Ref: 'AccountTable'
          }
        },
        TableArn: {
          Description: 'ARN of the created DynamoDB table',
          Value: {
            'Fn::GetAtt': ['AccountTable', 'Arn']
          }
        }
      }
    };
  }

  /**
   * Create DynamoDB table in account account via CloudFormation
   */
  static async createAccountDynamoDBTable(accountId, accountAccountId) {
    Logger.debug({ accountId, accountAccountId }, 'AccountService.createAccountDynamoDBTable - Starting table creation');

    try {
      // Configure STS to assume role in account account
      const adminAccountId = config.CROSS_ACCOUNT.ADMIN_ACCOUNT_ID;
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      // Assume role in account account
      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `AccountProvisioning-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      Logger.debug(assumeRoleParams, 'AccountService.createAccountDynamoDBTable - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure CloudFormation with assumed role credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      // Generate CloudFormation template
      const template = this.generateDynamoDBCloudFormationTemplate(accountId);
      const stackName = `account-${accountId}-dynamodb`;

      // Create CloudFormation stack
      const createStackParams = {
        StackName: stackName,
        TemplateBody: JSON.stringify(template),
        Tags: [
          {
            Key: 'AccountId',
            Value: accountId
          },
          {
            Key: 'CreatedBy',
            Value: 'AccountManagementSystem'
          },
          {
            Key: 'Environment',
            Value: process.env.NODE_ENV || 'development'
          }
        ]
      };

      Logger.debug({ stackName, accountId }, 'AccountService.createAccountDynamoDBTable - Creating CloudFormation stack');
      const createStackResult = await cloudFormation.createStack(createStackParams).promise();

      const stackId = createStackResult.StackId;
      Logger.debug({ stackId, accountId }, 'AccountService.createAccountDynamoDBTable - CloudFormation stack creation initiated');

      // Return immediately without waiting for completion
      // The stack will be processed asynchronously by AWS CloudFormation
      const tableName = `ACCOUNT_${accountId}`;

      Logger.debug({ tableName, stackId, accountId }, 'AccountService.createAccountDynamoDBTable - Stack creation submitted successfully');

      return {
        stackId,
        tableName,
        status: 'CREATE_IN_PROGRESS'
      };

    } catch (error) {
      Logger.error(error, 'AccountService.createAccountDynamoDBTable - Error occurred');
      throw new InternalError(`Failed to create account DynamoDB table: ${error.message}`);
    }
  }

  /**
   * Create initial entry in account DynamoDB table after CloudFormation completion
   * This method should be called asynchronously or via a scheduled job
   */
  static async createInitialEntryAfterStackCompletion(accountId, stackId, accountAccountId) {
    Logger.debug({ accountId, stackId }, 'AccountService.createInitialEntryAfterStackCompletion - Checking stack status and creating initial entry');

    try {
      // Check if stack is complete
      const stackStatus = await this.checkAccountProvisioningStatus(accountId, stackId, accountAccountId);

      if (stackStatus.stackStatus === 'CREATE_COMPLETE') {
        // Get table name from stack outputs
        const tableName = stackStatus.outputs.find(output => output.OutputKey === 'TableName')?.OutputValue;

        if (tableName) {
          // Configure STS to assume role in account account
          const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

          const sts = new AWS.STS({
            region: config.CROSS_ACCOUNT.AWS_REGION
          });

          const assumeRoleParams = {
            RoleArn: accountRoleArn,
            RoleSessionName: `InitialEntry-${accountId}-${Date.now()}`,
            DurationSeconds: 3600,
            ExternalId: 'account-provisioning'
          };

          const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

          // Create initial entry in the account table
          await this.createInitialAccountEntry(accountId, tableName, assumeRoleResult.Credentials);

          // Update account status
          await Mapping.updateAccount(accountId, {
            provisioningState: 'active',
            cloudFormationStatus: {
              stackStatus: 'CREATE_COMPLETE',
              lastChecked: moment().toISOString()
            },
            initialEntryCreated: true,
            provisioningCompletedAt: moment().toISOString(),
            lastModified: moment().toISOString()
          });

          Logger.debug({ accountId, tableName }, 'AccountService.createInitialEntryAfterStackCompletion - Initial entry created successfully');

          return {
            success: true,
            tableName,
            status: 'COMPLETED'
          };
        }
      } else if (stackStatus.stackStatus.includes('FAILED')) {
        // Update account status to failed
        await Mapping.updateAccount(accountId, {
          provisioningState: 'failed',
          cloudFormationStatus: {
            stackStatus: stackStatus.stackStatus,
            stackStatusReason: stackStatus.stackStatusReason,
            lastChecked: moment().toISOString()
          },
          provisioningError: stackStatus.stackStatusReason,
          lastModified: moment().toISOString()
        });

        Logger.error({ accountId, stackStatus }, 'AccountService.createInitialEntryAfterStackCompletion - CloudFormation stack failed');

        return {
          success: false,
          error: stackStatus.stackStatusReason,
          status: 'FAILED'
        };
      } else {
        Logger.debug({ accountId, stackStatus: stackStatus.stackStatus }, 'AccountService.createInitialEntryAfterStackCompletion - Stack still in progress');

        return {
          success: false,
          status: 'IN_PROGRESS',
          stackStatus: stackStatus.stackStatus
        };
      }

    } catch (error) {
      Logger.error(error, 'AccountService.createInitialEntryAfterStackCompletion - Error occurred');

      // Update account status to failed
      await Mapping.updateAccount(accountId, {
        provisioningState: 'failed',
        provisioningError: error.message,
        lastModified: moment().toISOString()
      });

      throw new InternalError(`Failed to create initial entry after stack completion: ${error.message}`);
    }
  }

  /**
   * Create initial entry in account DynamoDB table
   */
  static async createInitialAccountEntry(accountId, tableName, credentials) {
    Logger.debug({ accountId, tableName }, 'AccountService.createInitialAccountEntry - Creating initial entry');

    try {
      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken
      });

      // Create initial entry
      const initialEntry = {
        PK: `ACCOUNT#${accountId}`,
        SK: 'init',
        accountId: accountId,
        createdAt: moment().toISOString(),
        status: 'initialized',
        version: '1.0.0'
      };

      const putParams = {
        TableName: tableName,
        Item: initialEntry
      };

      await dynamodb.put(putParams).promise();
      Logger.debug({ accountId, tableName }, 'AccountService.createInitialAccountEntry - Initial entry created successfully');

    } catch (error) {
      Logger.error(error, 'AccountService.createInitialAccountEntry - Error occurred');
      throw new InternalError(`Failed to create initial account entry: ${error.message}`);
    }
  }

  /**
   * Complete provisioning for a account (create initial entry after CloudFormation completion)
   */
  static async completeProvisioningForAccount(accountId) {
    Logger.debug({ accountId }, 'AccountService.completeProvisioningForAccount - Completing provisioning');

    try {
      // Get account details from DynamoDB
      const account = await Mapping.getAccount(accountId);
      if (!account) {
        Logger.warn({ accountId }, 'AccountService.completeProvisioningForAccount - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId }
        );
      }

      // Only process private tier accounts with CloudFormation stacks
      if (account.subscriptionTier !== 'private' || !account.cloudFormationStackId) {
        Logger.warn({ accountId }, 'AccountService.completeProvisioningForAccount - Not a private tier account with CloudFormation stack');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Account is not a private tier account with CloudFormation stack',
          { accountId, subscriptionTier: account.subscriptionTier }
        );
      }

      // Complete the provisioning
      const result = await this.createInitialEntryAfterStackCompletion(
        accountId,
        account.cloudFormationStackId,
        account.accountAccountId
      );

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Account provisioning completion processed',
        result
      );

    } catch (error) {
      Logger.error(error, 'AccountService.completeProvisioningForAccount - Error occurred');
      throw new InternalError(`Failed to complete account provisioning: ${error.message}`);
    }
  }

  /**
   * Get account provisioning status
   */
  static async getAccountProvisioningStatus(accountId) {
    Logger.debug({ accountId }, 'AccountService.getAccountProvisioningStatus - Getting provisioning status');

    try {
      // Get account details from DynamoDB
      const account = await Mapping.getAccount(accountId);
      if (!account) {
        Logger.warn({ accountId }, 'AccountService.getAccountProvisioningStatus - Account not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Account not found',
          { accountId }
        );
      }

      let provisioningDetails = {
        accountId: account.accountId,
        provisioningState: account.provisioningState,
        subscriptionTier: account.subscriptionTier,
        lastModified: account.lastModified,
        accountTableName: account.accountTableName,
        accountAccountId: account.accountAccountId
      };

      // Check Step Functions execution status if available
      if (account.stepFunctionExecutionArn) {
        try {
          const stepFunctionStatus = await this.checkStepFunctionStatus(account.stepFunctionExecutionArn);
          provisioningDetails.stepFunctionStatus = stepFunctionStatus;

          // Update account status based on Step Functions status
          if (stepFunctionStatus.status === 'SUCCEEDED' && (account.provisioningState === 'creating' || account.provisioningState === 'deleting')) {
            const newState = account.provisioningState === 'creating' ? 'active' : 'deleted';
            await Mapping.updateAccount(accountId, {
              provisioningState: newState,
              stepFunctionStatus: stepFunctionStatus,
              lastModified: moment().toISOString()
            });
            provisioningDetails.provisioningState = newState;

          } else if (stepFunctionStatus.status === 'FAILED' && (account.provisioningState === 'creating' || account.provisioningState === 'deleting')) {
            const failedState = account.provisioningState === 'creating' ? 'failed' : 'deletion_failed';
            await Mapping.updateAccount(accountId, {
              provisioningState: failedState,
              provisioningError: stepFunctionStatus.error || 'Step Function execution failed',
              stepFunctionStatus: stepFunctionStatus,
              lastModified: moment().toISOString()
            });
            provisioningDetails.provisioningState = failedState;
            provisioningDetails.provisioningError = stepFunctionStatus.error || 'Step Function execution failed';
          }

        } catch (stepFunctionError) {
          Logger.error(stepFunctionError, 'AccountService.getAccountProvisioningStatus - Error checking Step Functions status');
          provisioningDetails.stepFunctionError = stepFunctionError.message;
        }
      }

      // Legacy support: For private subscription tier, check CloudFormation stack status if no Step Functions execution
      if (!account.stepFunctionExecutionArn && account.subscriptionTier === 'private' && account.cloudFormationStackId && account.accountAccountId) {
        try {
          const stackStatus = await this.checkAccountProvisioningStatus(
            accountId,
            account.cloudFormationStackId,
            account.accountAccountId
          );

          provisioningDetails.cloudFormationStatus = stackStatus;

          // Update account status if CloudFormation status has changed
          if (stackStatus.stackStatus === 'CREATE_COMPLETE' && account.provisioningState === 'creating') {
            await Mapping.updateAccountStatus(accountId, 'active');
            provisioningDetails.provisioningState = 'active';
          } else if (stackStatus.stackStatus.includes('FAILED') && account.provisioningState === 'creating') {
            await Mapping.updateAccountStatus(accountId, 'failed');
            provisioningDetails.provisioningState = 'failed';
            provisioningDetails.provisioningError = stackStatus.stackStatusReason;
          }

        } catch (stackError) {
          Logger.error(stackError, 'AccountService.getAccountProvisioningStatus - Error checking CloudFormation status');
          provisioningDetails.cloudFormationError = stackError.message;
        }
      }

      // For public subscription tier, check if entry exists in ACCOUNT_PUBLIC table (legacy support)
      if (!account.stepFunctionExecutionArn && account.subscriptionTier === 'public' && account.accountAccountId) {
        try {
          const entryStatus = await this.checkAccountEntryInPublicTable(accountId, account.accountAccountId);
          provisioningDetails.accountEntryStatus = entryStatus;

        } catch (entryError) {
          Logger.error(entryError, 'AccountService.getAccountProvisioningStatus - Error checking account entry');
          provisioningDetails.accountEntryError = entryError.message;
        }
      }

      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Account provisioning status retrieved successfully',
        provisioningDetails
      );

    } catch (error) {
      Logger.error(error, 'AccountService.getAccountProvisioningStatus - Error occurred');
      throw new InternalError(`Failed to get account provisioning status: ${error.message}`);
    }
  }

  /**
   * Check if account entry exists in ACCOUNT_PUBLIC table
   */
  static async checkAccountEntryInPublicTable(accountId, accountAccountId) {
    Logger.debug({ accountId, accountAccountId }, 'AccountService.checkAccountEntryInPublicTable - Checking account entry');

    try {
      // Configure STS to assume role in account account
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      // Assume role in account account
      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `AccountEntryCheck-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      // Check if account entry exists
      const getParams = {
        TableName: 'ACCOUNT_PUBLIC',
        Key: {
          PK: `ACCOUNT#${accountId}`,
          SK: 'init'
        }
      };

      const result = await dynamodb.get(getParams).promise();

      if (result.Item) {
        return {
          exists: true,
          status: 'FOUND',
          entry: result.Item,
          lastChecked: moment().toISOString()
        };
      } else {
        return {
          exists: false,
          status: 'NOT_FOUND',
          lastChecked: moment().toISOString()
        };
      }

    } catch (error) {
      Logger.error(error, 'AccountService.checkAccountEntryInPublicTable - Error occurred');
      throw new InternalError(`Failed to check account entry in ACCOUNT_PUBLIC table: ${error.message}`);
    }
  }

  /**
   * Check CloudFormation stack status for account provisioning
   */
  static async checkAccountProvisioningStatus(accountId, stackId, accountAccountId) {
    Logger.debug({ accountId, stackId }, 'AccountService.checkAccountProvisioningStatus - Checking stack status');

    try {
      // Configure STS to assume role in account account
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      // Assume role in account account
      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `AccountStatusCheck-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure CloudFormation with assumed role credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      // Check stack status
      const describeStackParams = {
        StackName: stackId
      };

      const stackDescription = await cloudFormation.describeStacks(describeStackParams).promise();
      const stack = stackDescription.Stacks[0];

      return {
        stackId: stackId,
        stackStatus: stack.StackStatus,
        stackStatusReason: stack.StackStatusReason,
        creationTime: stack.CreationTime,
        lastUpdatedTime: stack.LastUpdatedTime,
        outputs: stack.Outputs || []
      };

    } catch (error) {
      Logger.error(error, 'AccountService.checkAccountProvisioningStatus - Error occurred');
      throw new InternalError(`Failed to check account provisioning status: ${error.message}`);
    }
  }

  /**
   * Helper method to trigger schema creation in RDS (placeholder)
   */
  static async triggerSchemaCreation(account) {
    Logger.debug({ accountId: account.accountId }, 'AccountService.triggerSchemaCreation - Triggering schema creation');

    // TODO: Implement Step Function trigger for RDS schema creation
    // This would typically involve:
    // 1. Invoke Step Function with account data
    // 2. Step Function would execute Lambda to create schema
    // 3. Update account status based on schema creation result

    Logger.debug({ accountId: account.accountId }, 'AccountService.triggerSchemaCreation - Schema creation triggered');
  }

  /**
   * Helper method to trigger schema deletion in RDS (placeholder)
   */
  static async triggerSchemaDeletion(account) {
    Logger.debug({ accountId: account.accountId }, 'AccountService.triggerSchemaDeletion - Triggering schema deletion');

    // TODO: Implement Step Function trigger for RDS schema deletion
    // This would typically involve:
    // 1. Invoke Step Function with account data
    // 2. Step Function would execute Lambda to delete schema
    // 3. Cleanup all account data from schema before deletion

    Logger.debug({ accountId: account.accountId }, 'AccountService.triggerSchemaDeletion - Schema deletion triggered');
  }

  /**
   * Delete CloudFormation stack for private account in account account
   */
  static async deleteAccountCloudFormationStack(accountId, stackId) {
    Logger.debug({ accountId, stackId }, 'AccountService.deleteAccountCloudFormationStack - Starting stack deletion');

    try {
      // Configure STS to assume role in account account
      const accountAccountId = config.CROSS_ACCOUNT.ACCOUNT_ACCOUNT_ID;
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `DeleteStack-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      Logger.debug(assumeRoleParams, 'AccountService.deleteAccountCloudFormationStack - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure CloudFormation with assumed role credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      // Generate stack name (should match the creation pattern)
      const stackName = `account-${accountId}-dynamodb`;

      // Delete CloudFormation stack
      const deleteStackParams = {
        StackName: stackName
      };

      Logger.debug({ stackName, accountId }, 'AccountService.deleteAccountCloudFormationStack - Deleting CloudFormation stack');
      await cloudFormation.deleteStack(deleteStackParams).promise();

      Logger.debug({ stackName, accountId }, 'AccountService.deleteAccountCloudFormationStack - CloudFormation stack deletion initiated successfully');

      return {
        stackName,
        status: 'DELETE_IN_PROGRESS',
        message: 'Stack deletion initiated successfully'
      };

    } catch (error) {
      Logger.error(error, 'AccountService.deleteAccountCloudFormationStack - Error occurred');
      throw new InternalError(`Failed to delete CloudFormation stack: ${error.message}`);
    }
  }

  /**
   * Delete all items with PK "ACCOUNT#<ACCOUNT_ID>" from ACCOUNT_PUBLIC table
   */
  static async deletePublicAccountData(accountId) {
    Logger.debug({ accountId }, 'AccountService.deletePublicAccountData - Starting public account data deletion');

    try {
      // Configure DynamoDB for account account
      const accountAccountId = config.CROSS_ACCOUNT.ACCOUNT_ACCOUNT_ID;
      const accountRoleArn = `arn:aws:iam::${accountAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;

      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });

      const assumeRoleParams = {
        RoleArn: accountRoleArn,
        RoleSessionName: `DeletePublicData-${accountId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'account-provisioning'
      };

      Logger.debug(assumeRoleParams, 'AccountService.deletePublicAccountData - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();

      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });

      const tableName = 'ACCOUNT_PUBLIC';
      const accountPK = `ACCOUNT#${accountId}`;

      // Query all items with the account PK
      const queryParams = {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': accountPK
        }
      };

      Logger.debug({ tableName, accountPK }, 'AccountService.deletePublicAccountData - Querying items to delete');

      let itemsToDelete = [];
      let lastEvaluatedKey = null;

      do {
        if (lastEvaluatedKey) {
          queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const queryResult = await dynamodb.query(queryParams).promise();
        itemsToDelete = itemsToDelete.concat(queryResult.Items);
        lastEvaluatedKey = queryResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      Logger.debug({ accountId, itemCount: itemsToDelete.length }, 'AccountService.deletePublicAccountData - Found items to delete');

      // Delete items in batches of 25 (DynamoDB batch limit)
      const batchSize = 25;
      let deletedCount = 0;

      for (let i = 0; i < itemsToDelete.length; i += batchSize) {
        const batch = itemsToDelete.slice(i, i + batchSize);

        const deleteRequests = batch.map(item => ({
          DeleteRequest: {
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          }
        }));

        const batchWriteParams = {
          RequestItems: {
            [tableName]: deleteRequests
          }
        };

        Logger.debug({ accountId, batchNumber: Math.floor(i / batchSize) + 1, batchSize: batch.length }, 'AccountService.deletePublicAccountData - Deleting batch');
        await dynamodb.batchWrite(batchWriteParams).promise();
        deletedCount += batch.length;
      }

      Logger.debug({ accountId, deletedCount }, 'AccountService.deletePublicAccountData - Public account data deletion completed');

      return {
        deletedCount,
        tableName,
        message: 'All public account data deleted successfully'
      };

    } catch (error) {
      Logger.error(error, 'AccountService.deletePublicAccountData - Error occurred');
      throw new InternalError(`Failed to delete public account data: ${error.message}`);
    }
  }
}

module.exports = AccountService;
