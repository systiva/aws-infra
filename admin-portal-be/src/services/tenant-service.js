const Commons = require('../utils/commons/common-utilities');
const Constants = require('../../constant');
const Logger = require('../../logger');
const InternalError = require('../utils/error/internal-error');
const config = require('../../config');
const Mapping = require('../db/access-patterns/mapping');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

class TenantService {
  
  /**
   * Get all tenants from DynamoDB with total count
   */
  static async getAllTenants() {
    Logger.debug('TenantService.getAllTenants - Starting to retrieve all tenants');
    
    try {
      // Scan all tenants from DynamoDB
      const tenants = await Mapping.scanTenants();
      Logger.debug({ count: tenants.length }, 'TenantService.getAllTenants - Retrieved tenants count');
      
      const response = {
        tenants: tenants,
        totalCount: tenants.length,
        timestamp: moment().toISOString()
      };
      
      Logger.debug(response, 'TenantService.getAllTenants - Response prepared');
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenants retrieved successfully',
        response
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.getAllTenants - Error occurred');
      throw new InternalError(`Failed to retrieve tenants: ${error.message}`);
    }
  }

  /**
   * Get individual tenant details by ID
   */
  static async getTenantDetails(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.getTenantDetails - Getting tenant details');
    
    try {
      const tenant = await Mapping.getTenant(tenantId);
      if (!tenant) {
        Logger.warn({ tenantId }, 'TenantService.getTenantDetails - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId }
        );
      }
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenant details retrieved successfully',
        tenant
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.getTenantDetails - Error occurred');
      throw new InternalError(`Failed to get tenant details: ${error.message}`);
    }
  }

  /**
   * Create a new tenant in DynamoDB
   */
  static async createTenant(tenantData) {
    Logger.debug(tenantData, 'TenantService.createTenant - Creating tenant with data');
    
    try {
      // Validate required fields
      const requiredFields = ['tenantName', 'email', 'subscriptionTier', 'firstName', 'lastName', 'adminUsername', 'adminEmail'];
      for (const field of requiredFields) {
        if (!tenantData[field]) {
          throw new InternalError(`Missing required field: ${field}`);
        }
      }
      
      // Validate subscription tier values
      const validSubscriptionTiers = ['public', 'private'];
      if (!validSubscriptionTiers.includes(tenantData.subscriptionTier)) {
        throw new InternalError(`Invalid subscription tier. Must be one of: ${validSubscriptionTiers.join(', ')}`);
      }
      
      // Generate simple 8-character tenant ID (YYYYMMDD or YYMMDDHH format)
      let tenantId = moment().format('YYYYMMDD');
      
      // Check if tenant with this ID already exists
      let existingTenantById = await Mapping.getTenant(tenantId);
      
      // If exists, use YYMMDDHH format to keep it 8 characters
      if (existingTenantById) {
        tenantId = moment().format('YYMMDDHH');
        existingTenantById = await Mapping.getTenant(tenantId);
        
        // If still exists, add random 2-digit suffix
        if (existingTenantById) {
          const randomSuffix = Math.floor(Math.random() * 99).toString().padStart(2, '0');
          tenantId = moment().format('YYMMDD') + randomSuffix;
        }
      }
      
      // Prepare tenant object
      const tenant = {
        tenantId: tenantId,
        tenantName: tenantData.tenantName,
        email: tenantData.email,
        firstName: tenantData.firstName,
        lastName: tenantData.lastName,
        adminUsername: tenantData.adminUsername, // Username for Cognito login
        adminEmail: tenantData.adminEmail,
        adminPassword: tenantData.adminPassword, // Optional, will be filtered if undefined
        subscriptionTier: tenantData.subscriptionTier,
        provisioningState: 'creating',
        registeredOn: moment().toISOString(),
        createdBy: tenantData.createdBy || 'system',
        lastModified: moment().toISOString()
      };
      
      Logger.debug(tenant, 'TenantService.createTenant - Prepared tenant object');
      
      // Check if tenant with same tenant name already exists
      const existingTenant = await Mapping.getTenantByName(tenantData.tenantName);
      if (existingTenant) {
        Logger.warn({ tenantName: tenantData.tenantName }, 'TenantService.createTenant - Tenant already exists');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Tenant with this name already exists',
          { existingTenantId: existingTenant.tenantId }
        );
      }
      
      // Save tenant to DynamoDB with 'creating' status
      await Mapping.createTenant(tenant);
      Logger.debug({ tenantId }, 'TenantService.createTenant - Tenant created in DynamoDB with creating status');
      
      // Start Step Functions workflow for tenant provisioning
      try {
        const tenantAccountId = config.CROSS_ACCOUNT.TENANT_ACCOUNT_ID;
        
        // Start Step Functions execution for tenant creation
        const stepFunctionsResult = await this.startTenantCreationWorkflow(tenant, tenantAccountId);
        
        // Update tenant with Step Functions execution info
        const updateData = {
          stepFunctionExecutionArn: stepFunctionsResult.executionArn,
          tenantAccountId: tenantAccountId,
          subscriptionTier: tenantData.subscriptionTier,
          provisioningState: 'creating',
          stepFunctionStatus: {
            executionStatus: 'RUNNING',
            lastChecked: moment().toISOString()
          },
          lastModified: moment().toISOString(),
          provisioningSubmittedAt: moment().toISOString()
        };
        
        // Set expected table name based on subscription tier
        if (tenantData.subscriptionTier === 'private') {
          updateData.tenantTableName = `TENANT_${tenantId}`;
        } else {
          updateData.tenantTableName = 'TENANT_PUBLIC';
        }
        
        await Mapping.updateTenant(tenantId, updateData);
        
        // Update local tenant object for response
        Object.assign(tenant, updateData);
        
        Logger.debug({ 
          tenantId, 
          subscriptionTier: tenantData.subscriptionTier,
          executionArn: stepFunctionsResult.executionArn,
          tableName: updateData.tenantTableName
        }, 'TenantService.createTenant - Step Functions workflow started successfully');
        
      } catch (provisioningError) {
        Logger.error(provisioningError, 'TenantService.createTenant - Error starting Step Functions workflow');
        
        // Update tenant status to 'failed' if Step Functions fails
        await Mapping.updateTenant(tenantId, {
          provisioningState: 'failed',
          provisioningError: provisioningError.message,
          lastModified: moment().toISOString()
        });
        
        tenant.provisioningState = 'failed';
        tenant.provisioningError = provisioningError.message;
        
        // Return the tenant with failed status rather than throwing error
        return Commons.getRes(
          Constants.HTTP_STATUS.CREATED,
          'Tenant created but provisioning failed',
          tenant
        );
      }
      
      Logger.debug({ tenantId, subscriptionTier: tenantData.subscriptionTier }, 'TenantService.createTenant - Tenant onboarding workflow started');
      
      return Commons.getRes(
        Constants.HTTP_STATUS.CREATED,
        'Tenant created successfully',
        tenant
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.createTenant - Error occurred');
      throw new InternalError(`Failed to create tenant: ${error.message}`);
    }
  }

  /**
   * Start Step Functions workflow for tenant creation
   */
  static async startTenantCreationWorkflow(tenant, tenantAccountId) {
    Logger.debug({ tenantId: tenant.tenantId, subscriptionTier: tenant.subscriptionTier }, 'TenantService.startTenantCreationWorkflow - Starting workflow');
    
    try {
      const stepfunctions = new AWS.StepFunctions({
        region: config.AWS_REGION
      });
      
      const input = {
        operation: 'CREATE',
        tenantId: tenant.tenantId,
        tenantAccountId: tenantAccountId,
        subscriptionTier: tenant.subscriptionTier,
        tenantName: tenant.tenantName,
        email: tenant.email,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        adminUsername: tenant.adminUsername,
        adminEmail: tenant.adminEmail,
        adminPassword: tenant.adminPassword,
        createdBy: tenant.createdBy,
        registeredOn: tenant.registeredOn
      };
      
      const params = {
        stateMachineArn: config.STEP_FUNCTIONS.CREATE_TENANT_STATE_MACHINE_ARN,
        input: JSON.stringify(input),
        name: `create-tenant-${tenant.tenantId}-${Date.now()}`
      };
      
      const result = await stepfunctions.startExecution(params).promise();
      
      Logger.debug({ 
        tenantId: tenant.tenantId, 
        executionArn: result.executionArn 
      }, 'TenantService.startTenantCreationWorkflow - Workflow started successfully');
      
      return result;
      
    } catch (error) {
      Logger.error(error, 'TenantService.startTenantCreationWorkflow - Error occurred');
      throw error;
    }
  }

  /**
   * Start Step Functions workflow for tenant deletion
   */
  static async startTenantDeletionWorkflow(tenant, tenantAccountId) {
    Logger.debug({ tenantId: tenant.tenantId, subscriptionTier: tenant.subscriptionTier }, 'TenantService.startTenantDeletionWorkflow - Starting workflow');
    
    try {
      const stepfunctions = new AWS.StepFunctions({
        region: config.AWS_REGION
      });
      
      const input = {
        operation: 'DELETE',
        tenantId: tenant.tenantId,
        tenantAccountId: tenantAccountId,
        subscriptionTier: tenant.subscriptionTier,
        tenantName: tenant.tenantName,
        email: tenant.email,
        deletedBy: 'admin-portal',
        deletedOn: moment().toISOString()
      };

      // For private tenants, include stackId if available
      if (tenant.subscriptionTier === 'private') {
        if (tenant.cloudFormationStackId) {
          input.stackId = tenant.cloudFormationStackId;
          Logger.debug({ 
            tenantId: tenant.tenantId, 
            stackId: tenant.cloudFormationStackId 
          }, 'TenantService.startTenantDeletionWorkflow - Including stackId for private tenant');
        } else {
          // Generate expected stack name if stackId is not available
          input.stackId = `tenant-${tenant.tenantId}-dynamodb`;
          Logger.debug({ 
            tenantId: tenant.tenantId, 
            stackId: input.stackId 
          }, 'TenantService.startTenantDeletionWorkflow - Generated stackId for private tenant (no cloudFormationStackId found)');
        }
      }
      
      const params = {
        stateMachineArn: config.STEP_FUNCTIONS.DELETE_TENANT_STATE_MACHINE_ARN,
        input: JSON.stringify(input),
        name: `delete-tenant-${tenant.tenantId}-${Date.now()}`
      };
      
      Logger.debug({ 
        tenantId: tenant.tenantId,
        subscriptionTier: tenant.subscriptionTier,
        stepFunctionsInput: input 
      }, 'TenantService.startTenantDeletionWorkflow - Step Functions input prepared');
      
      const result = await stepfunctions.startExecution(params).promise();
      
      Logger.debug({ 
        tenantId: tenant.tenantId, 
        executionArn: result.executionArn 
      }, 'TenantService.startTenantDeletionWorkflow - Workflow started successfully');
      
      return result;
      
    } catch (error) {
      Logger.error(error, 'TenantService.startTenantDeletionWorkflow - Error occurred');
      throw error;
    }
  }

  /**
   * Check Step Functions execution status
   */
  static async checkStepFunctionStatus(executionArn) {
    Logger.debug({ executionArn }, 'TenantService.checkStepFunctionStatus - Checking execution status');
    
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
      }, 'TenantService.checkStepFunctionStatus - Execution status retrieved');
      
      return statusInfo;
      
    } catch (error) {
      Logger.error(error, 'TenantService.checkStepFunctionStatus - Error occurred');
      throw error;
    }
  }

  /**
   * Update existing tenant in DynamoDB
   */
  static async updateTenant(tenantData) {
    Logger.debug(tenantData, 'TenantService.updateTenant - Updating tenant with data');
    
    try {
      // Validate tenant ID
      if (!tenantData.tenantId) {
        throw new InternalError('Missing required field: tenantId');
      }
      
      // Validate subscription tier if provided
      if (tenantData.subscriptionTier) {
        const validSubscriptionTiers = ['public', 'private'];
        if (!validSubscriptionTiers.includes(tenantData.subscriptionTier)) {
          throw new InternalError(`Invalid subscription tier. Must be one of: ${validSubscriptionTiers.join(', ')}`);
        }
      }
      
      // Check if tenant exists
      const existingTenant = await Mapping.getTenant(tenantData.tenantId);
      if (!existingTenant) {
        Logger.warn({ tenantId: tenantData.tenantId }, 'TenantService.updateTenant - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId: tenantData.tenantId }
        );
      }
      
      // Prepare update data
      const updateData = {
        ...existingTenant,
        ...tenantData,
        lastModified: moment().toISOString()
      };
      
      // Don't allow updating certain fields
      delete updateData.tenantId;
      delete updateData.registeredOn;
      delete updateData.createdBy;
      
      Logger.debug(updateData, 'TenantService.updateTenant - Prepared update data');
      
      // Update tenant in DynamoDB
      const updatedTenant = await Mapping.updateTenant(tenantData.tenantId, updateData);
      Logger.debug({ tenantId: tenantData.tenantId }, 'TenantService.updateTenant - Tenant updated in DynamoDB');
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenant updated successfully',
        updatedTenant
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.updateTenant - Error occurred');
      throw new InternalError(`Failed to update tenant: ${error.message}`);
    }
  }

  /**
   * Delete tenant from DynamoDB and handle subscription tier specific cleanup
   */
  static async deleteTenant(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.deleteTenant - Deleting tenant');
    
    try {
      // Validate tenant ID
      if (!tenantId) {
        throw new InternalError('Tenant ID is required');
      }
      
      // Check if tenant exists
      const existingTenant = await Mapping.getTenant(tenantId);
      if (!existingTenant) {
        Logger.warn({ tenantId }, 'TenantService.deleteTenant - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId }
        );
      }
      
      // Update tenant status to 'deleting' before actual deletion
      await Mapping.updateTenant(tenantId, { 
        provisioningState: 'deleting',
        lastModified: moment().toISOString()
      });
      Logger.debug({ tenantId }, 'TenantService.deleteTenant - Tenant status updated to deleting');
      
      // Start Step Functions workflow for tenant deletion
      try {
        const tenantAccountId = config.CROSS_ACCOUNT.TENANT_ACCOUNT_ID;
        
        // Start Step Functions execution for tenant deletion
        const stepFunctionsResult = await this.startTenantDeletionWorkflow(existingTenant, tenantAccountId);
        
        // Update tenant with Step Functions execution info
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
        
        await Mapping.updateTenant(tenantId, updateData);
        
        Logger.debug({ 
          tenantId, 
          subscriptionTier: existingTenant.subscriptionTier,
          executionArn: stepFunctionsResult.executionArn
        }, 'TenantService.deleteTenant - Step Functions deletion workflow started successfully');
        
        return Commons.getRes(
          Constants.HTTP_STATUS.OK,
          'Tenant deletion initiated successfully',
          { 
            tenantId,
            subscriptionTier: existingTenant.subscriptionTier,
            deletedAt: moment().toISOString(),
            executionArn: stepFunctionsResult.executionArn,
            organizationName: existingTenant.organizationName,
            note: 'Step Functions deletion workflow initiated asynchronously'
          }
        );
        
      } catch (deletionError) {
        Logger.error(deletionError, 'TenantService.deleteTenant - Error starting Step Functions deletion workflow');
        
        // Update tenant status to 'deletion_failed' if Step Functions fails
        await Mapping.updateTenant(tenantId, {
          provisioningState: 'deletion_failed',
          provisioningError: deletionError.message,
          lastModified: moment().toISOString()
        });
        
        // Return error status rather than throwing exception
        return Commons.getRes(
          Constants.HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'Tenant deletion workflow failed to start',
          { 
            tenantId,
            error: deletionError.message,
            deletionFailedAt: moment().toISOString()
          }
        );
      }
      
    } catch (error) {
      Logger.error(error, 'TenantService.deleteTenant - Error occurred');
      throw new InternalError(`Failed to delete tenant: ${error.message}`);
    }
  }

  /**
   * Suspend tenant by setting provisioningState to 'inactive'
   */
  static async suspendTenant(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.suspendTenant - Suspending tenant');
    
    try {
      // Validate tenant ID
      if (!tenantId) {
        throw new InternalError('Tenant ID is required');
      }
      
      // Check if tenant exists
      const existingTenant = await Mapping.getTenant(tenantId);
      if (!existingTenant) {
        Logger.warn({ tenantId }, 'TenantService.suspendTenant - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId }
        );
      }
      
      // Check if tenant is already inactive
      if (existingTenant.provisioningState === 'inactive') {
        Logger.warn({ tenantId }, 'TenantService.suspendTenant - Tenant already suspended');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Tenant is already suspended',
          existingTenant
        );
      }
      
      // Update tenant status to 'inactive'
      const updateData = {
        provisioningState: 'inactive',
        lastModified: moment().toISOString(),
        suspendedAt: moment().toISOString()
      };
      
      const updatedTenant = await Mapping.updateTenant(tenantId, updateData);
      Logger.debug({ tenantId }, 'TenantService.suspendTenant - Tenant suspended successfully');
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenant suspended successfully',
        updatedTenant
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.suspendTenant - Error occurred');
      throw new InternalError(`Failed to suspend tenant: ${error.message}`);
    }
  }

  /**
   * Create tenant entry in existing TENANT_PUBLIC table in tenant account
   */
  static async createTenantEntryInPublicTable(tenantId, tenantAccountId) {
    Logger.debug({ tenantId, tenantAccountId }, 'TenantService.createTenantEntryInPublicTable - Creating entry in TENANT_PUBLIC table');
    
    try {
      // Configure STS to assume role in tenant account
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      // Assume role in tenant account
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `TenantEntry-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
      };
      
      Logger.debug(assumeRoleParams, 'TenantService.createTenantEntryInPublicTable - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
      
      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });
      
      // Create tenant entry in TENANT_PUBLIC table
      const tenantEntry = {
        PK: `TENANT#${tenantId}`,
        SK: 'init',
        tenantId: tenantId,
        createdAt: moment().toISOString(),
        status: 'initialized',
        subscriptionTier: 'public',
        version: '1.0.0',
        lastModified: moment().toISOString()
      };
      
      const putParams = {
        TableName: 'TENANT_PUBLIC',
        Item: tenantEntry,
        // Ensure we don't overwrite existing entries
        ConditionExpression: 'attribute_not_exists(PK)'
      };
      
      await dynamodb.put(putParams).promise();
      Logger.debug({ tenantId, tableName: 'TENANT_PUBLIC' }, 'TenantService.createTenantEntryInPublicTable - Tenant entry created successfully');
      
      return {
        tableName: 'TENANT_PUBLIC',
        tenantEntry: tenantEntry,
        status: 'COMPLETED'
      };
      
    } catch (error) {
      Logger.error(error, 'TenantService.createTenantEntryInPublicTable - Error occurred');
      throw new InternalError(`Failed to create tenant entry in TENANT_PUBLIC table: ${error.message}`);
    }
  }

  /**
   * Generate CloudFormation template for tenant DynamoDB table
   */
  static generateDynamoDBCloudFormationTemplate(tenantId) {
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
                Key: 'TenantId',
                Value: tenantId
              },
              {
                Key: 'Environment',
                Value: process.env.NODE_ENV || 'development'
              },
              {
                Key: 'ManagedBy',
                Value: 'TenantManagementSystem'
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
   * Create DynamoDB table in tenant account via CloudFormation
   */
  static async createTenantDynamoDBTable(tenantId, tenantAccountId) {
    Logger.debug({ tenantId, tenantAccountId }, 'TenantService.createTenantDynamoDBTable - Starting table creation');
    
    try {
      // Configure STS to assume role in tenant account
      const adminAccountId = config.CROSS_ACCOUNT.ADMIN_ACCOUNT_ID;
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      // Assume role in tenant account
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `TenantProvisioning-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
      };
      
      Logger.debug(assumeRoleParams, 'TenantService.createTenantDynamoDBTable - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
      
      // Configure CloudFormation with assumed role credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });
      
      // Generate CloudFormation template
      const template = this.generateDynamoDBCloudFormationTemplate(tenantId);
      const stackName = `tenant-${tenantId}-dynamodb`;
      
      // Create CloudFormation stack
      const createStackParams = {
        StackName: stackName,
        TemplateBody: JSON.stringify(template),
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
            Key: 'Environment',
            Value: process.env.NODE_ENV || 'development'
          }
        ]
      };
      
      Logger.debug({ stackName, tenantId }, 'TenantService.createTenantDynamoDBTable - Creating CloudFormation stack');
      const createStackResult = await cloudFormation.createStack(createStackParams).promise();
      
      const stackId = createStackResult.StackId;
      Logger.debug({ stackId, tenantId }, 'TenantService.createTenantDynamoDBTable - CloudFormation stack creation initiated');
      
      // Return immediately without waiting for completion
      // The stack will be processed asynchronously by AWS CloudFormation
      const tableName = `TENANT_${tenantId}`;
      
      Logger.debug({ tableName, stackId, tenantId }, 'TenantService.createTenantDynamoDBTable - Stack creation submitted successfully');
      
      return {
        stackId,
        tableName,
        status: 'CREATE_IN_PROGRESS'
      };
      
    } catch (error) {
      Logger.error(error, 'TenantService.createTenantDynamoDBTable - Error occurred');
      throw new InternalError(`Failed to create tenant DynamoDB table: ${error.message}`);
    }
  }

  /**
   * Create initial entry in tenant DynamoDB table after CloudFormation completion
   * This method should be called asynchronously or via a scheduled job
   */
  static async createInitialEntryAfterStackCompletion(tenantId, stackId, tenantAccountId) {
    Logger.debug({ tenantId, stackId }, 'TenantService.createInitialEntryAfterStackCompletion - Checking stack status and creating initial entry');
    
    try {
      // Check if stack is complete
      const stackStatus = await this.checkTenantProvisioningStatus(tenantId, stackId, tenantAccountId);
      
      if (stackStatus.stackStatus === 'CREATE_COMPLETE') {
        // Get table name from stack outputs
        const tableName = stackStatus.outputs.find(output => output.OutputKey === 'TableName')?.OutputValue;
        
        if (tableName) {
          // Configure STS to assume role in tenant account
          const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
          
          const sts = new AWS.STS({
            region: config.CROSS_ACCOUNT.AWS_REGION
          });
          
          const assumeRoleParams = {
            RoleArn: tenantRoleArn,
            RoleSessionName: `InitialEntry-${tenantId}-${Date.now()}`,
            DurationSeconds: 3600,
            ExternalId: 'tenant-provisioning'
          };
          
          const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
          
          // Create initial entry in the tenant table
          await this.createInitialTenantEntry(tenantId, tableName, assumeRoleResult.Credentials);
          
          // Update tenant status
          await Mapping.updateTenant(tenantId, {
            provisioningState: 'active',
            cloudFormationStatus: {
              stackStatus: 'CREATE_COMPLETE',
              lastChecked: moment().toISOString()
            },
            initialEntryCreated: true,
            provisioningCompletedAt: moment().toISOString(),
            lastModified: moment().toISOString()
          });
          
          Logger.debug({ tenantId, tableName }, 'TenantService.createInitialEntryAfterStackCompletion - Initial entry created successfully');
          
          return {
            success: true,
            tableName,
            status: 'COMPLETED'
          };
        }
      } else if (stackStatus.stackStatus.includes('FAILED')) {
        // Update tenant status to failed
        await Mapping.updateTenant(tenantId, {
          provisioningState: 'failed',
          cloudFormationStatus: {
            stackStatus: stackStatus.stackStatus,
            stackStatusReason: stackStatus.stackStatusReason,
            lastChecked: moment().toISOString()
          },
          provisioningError: stackStatus.stackStatusReason,
          lastModified: moment().toISOString()
        });
        
        Logger.error({ tenantId, stackStatus }, 'TenantService.createInitialEntryAfterStackCompletion - CloudFormation stack failed');
        
        return {
          success: false,
          error: stackStatus.stackStatusReason,
          status: 'FAILED'
        };
      } else {
        Logger.debug({ tenantId, stackStatus: stackStatus.stackStatus }, 'TenantService.createInitialEntryAfterStackCompletion - Stack still in progress');
        
        return {
          success: false,
          status: 'IN_PROGRESS',
          stackStatus: stackStatus.stackStatus
        };
      }
      
    } catch (error) {
      Logger.error(error, 'TenantService.createInitialEntryAfterStackCompletion - Error occurred');
      
      // Update tenant status to failed
      await Mapping.updateTenant(tenantId, {
        provisioningState: 'failed',
        provisioningError: error.message,
        lastModified: moment().toISOString()
      });
      
      throw new InternalError(`Failed to create initial entry after stack completion: ${error.message}`);
    }
  }

  /**
   * Create initial entry in tenant DynamoDB table
   */
  static async createInitialTenantEntry(tenantId, tableName, credentials) {
    Logger.debug({ tenantId, tableName }, 'TenantService.createInitialTenantEntry - Creating initial entry');
    
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
        PK: `TENANT#${tenantId}`,
        SK: 'init',
        tenantId: tenantId,
        createdAt: moment().toISOString(),
        status: 'initialized',
        version: '1.0.0'
      };
      
      const putParams = {
        TableName: tableName,
        Item: initialEntry
      };
      
      await dynamodb.put(putParams).promise();
      Logger.debug({ tenantId, tableName }, 'TenantService.createInitialTenantEntry - Initial entry created successfully');
      
    } catch (error) {
      Logger.error(error, 'TenantService.createInitialTenantEntry - Error occurred');
      throw new InternalError(`Failed to create initial tenant entry: ${error.message}`);
    }
  }

  /**
   * Complete provisioning for a tenant (create initial entry after CloudFormation completion)
   */
  static async completeProvisioningForTenant(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.completeProvisioningForTenant - Completing provisioning');
    
    try {
      // Get tenant details from DynamoDB
      const tenant = await Mapping.getTenant(tenantId);
      if (!tenant) {
        Logger.warn({ tenantId }, 'TenantService.completeProvisioningForTenant - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId }
        );
      }
      
      // Only process private tier tenants with CloudFormation stacks
      if (tenant.subscriptionTier !== 'private' || !tenant.cloudFormationStackId) {
        Logger.warn({ tenantId }, 'TenantService.completeProvisioningForTenant - Not a private tier tenant with CloudFormation stack');
        return Commons.getRes(
          Constants.HTTP_STATUS.BAD_REQUEST,
          'Tenant is not a private tier tenant with CloudFormation stack',
          { tenantId, subscriptionTier: tenant.subscriptionTier }
        );
      }
      
      // Complete the provisioning
      const result = await this.createInitialEntryAfterStackCompletion(
        tenantId, 
        tenant.cloudFormationStackId, 
        tenant.tenantAccountId
      );
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenant provisioning completion processed',
        result
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.completeProvisioningForTenant - Error occurred');
      throw new InternalError(`Failed to complete tenant provisioning: ${error.message}`);
    }
  }

  /**
   * Get tenant provisioning status
   */
  static async getTenantProvisioningStatus(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.getTenantProvisioningStatus - Getting provisioning status');
    
    try {
      // Get tenant details from DynamoDB
      const tenant = await Mapping.getTenant(tenantId);
      if (!tenant) {
        Logger.warn({ tenantId }, 'TenantService.getTenantProvisioningStatus - Tenant not found');
        return Commons.getRes(
          Constants.HTTP_STATUS.NOT_FOUND,
          'Tenant not found',
          { tenantId }
        );
      }
      
      let provisioningDetails = {
        tenantId: tenant.tenantId,
        provisioningState: tenant.provisioningState,
        subscriptionTier: tenant.subscriptionTier,
        lastModified: tenant.lastModified,
        tenantTableName: tenant.tenantTableName,
        tenantAccountId: tenant.tenantAccountId
      };
      
      // Check Step Functions execution status if available
      if (tenant.stepFunctionExecutionArn) {
        try {
          const stepFunctionStatus = await this.checkStepFunctionStatus(tenant.stepFunctionExecutionArn);
          provisioningDetails.stepFunctionStatus = stepFunctionStatus;
          
          // Update tenant status based on Step Functions status
          if (stepFunctionStatus.status === 'SUCCEEDED' && (tenant.provisioningState === 'creating' || tenant.provisioningState === 'deleting')) {
            const newState = tenant.provisioningState === 'creating' ? 'active' : 'deleted';
            await Mapping.updateTenant(tenantId, {
              provisioningState: newState,
              stepFunctionStatus: stepFunctionStatus,
              lastModified: moment().toISOString()
            });
            provisioningDetails.provisioningState = newState;
            
          } else if (stepFunctionStatus.status === 'FAILED' && (tenant.provisioningState === 'creating' || tenant.provisioningState === 'deleting')) {
            const failedState = tenant.provisioningState === 'creating' ? 'failed' : 'deletion_failed';
            await Mapping.updateTenant(tenantId, {
              provisioningState: failedState,
              provisioningError: stepFunctionStatus.error || 'Step Function execution failed',
              stepFunctionStatus: stepFunctionStatus,
              lastModified: moment().toISOString()
            });
            provisioningDetails.provisioningState = failedState;
            provisioningDetails.provisioningError = stepFunctionStatus.error || 'Step Function execution failed';
          }
          
        } catch (stepFunctionError) {
          Logger.error(stepFunctionError, 'TenantService.getTenantProvisioningStatus - Error checking Step Functions status');
          provisioningDetails.stepFunctionError = stepFunctionError.message;
        }
      }
      
      // Legacy support: For private subscription tier, check CloudFormation stack status if no Step Functions execution
      if (!tenant.stepFunctionExecutionArn && tenant.subscriptionTier === 'private' && tenant.cloudFormationStackId && tenant.tenantAccountId) {
        try {
          const stackStatus = await this.checkTenantProvisioningStatus(
            tenantId, 
            tenant.cloudFormationStackId, 
            tenant.tenantAccountId
          );
          
          provisioningDetails.cloudFormationStatus = stackStatus;
          
          // Update tenant status if CloudFormation status has changed
          if (stackStatus.stackStatus === 'CREATE_COMPLETE' && tenant.provisioningState === 'creating') {
            await Mapping.updateTenantStatus(tenantId, 'active');
            provisioningDetails.provisioningState = 'active';
          } else if (stackStatus.stackStatus.includes('FAILED') && tenant.provisioningState === 'creating') {
            await Mapping.updateTenantStatus(tenantId, 'failed');
            provisioningDetails.provisioningState = 'failed';
            provisioningDetails.provisioningError = stackStatus.stackStatusReason;
          }
          
        } catch (stackError) {
          Logger.error(stackError, 'TenantService.getTenantProvisioningStatus - Error checking CloudFormation status');
          provisioningDetails.cloudFormationError = stackError.message;
        }
      }
      
      // For public subscription tier, check if entry exists in TENANT_PUBLIC table (legacy support)
      if (!tenant.stepFunctionExecutionArn && tenant.subscriptionTier === 'public' && tenant.tenantAccountId) {
        try {
          const entryStatus = await this.checkTenantEntryInPublicTable(tenantId, tenant.tenantAccountId);
          provisioningDetails.tenantEntryStatus = entryStatus;
          
        } catch (entryError) {
          Logger.error(entryError, 'TenantService.getTenantProvisioningStatus - Error checking tenant entry');
          provisioningDetails.tenantEntryError = entryError.message;
        }
      }
      
      return Commons.getRes(
        Constants.HTTP_STATUS.OK,
        'Tenant provisioning status retrieved successfully',
        provisioningDetails
      );
      
    } catch (error) {
      Logger.error(error, 'TenantService.getTenantProvisioningStatus - Error occurred');
      throw new InternalError(`Failed to get tenant provisioning status: ${error.message}`);
    }
  }

  /**
   * Check if tenant entry exists in TENANT_PUBLIC table
   */
  static async checkTenantEntryInPublicTable(tenantId, tenantAccountId) {
    Logger.debug({ tenantId, tenantAccountId }, 'TenantService.checkTenantEntryInPublicTable - Checking tenant entry');
    
    try {
      // Configure STS to assume role in tenant account
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      // Assume role in tenant account
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `TenantEntryCheck-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
      };
      
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
      
      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });
      
      // Check if tenant entry exists
      const getParams = {
        TableName: 'TENANT_PUBLIC',
        Key: {
          PK: `TENANT#${tenantId}`,
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
      Logger.error(error, 'TenantService.checkTenantEntryInPublicTable - Error occurred');
      throw new InternalError(`Failed to check tenant entry in TENANT_PUBLIC table: ${error.message}`);
    }
  }

  /**
   * Check CloudFormation stack status for tenant provisioning
   */
  static async checkTenantProvisioningStatus(tenantId, stackId, tenantAccountId) {
    Logger.debug({ tenantId, stackId }, 'TenantService.checkTenantProvisioningStatus - Checking stack status');
    
    try {
      // Configure STS to assume role in tenant account
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      // Assume role in tenant account
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `TenantStatusCheck-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
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
      Logger.error(error, 'TenantService.checkTenantProvisioningStatus - Error occurred');
      throw new InternalError(`Failed to check tenant provisioning status: ${error.message}`);
    }
  }

  /**
   * Helper method to trigger schema creation in RDS (placeholder)
   */
  static async triggerSchemaCreation(tenant) {
    Logger.debug({ tenantId: tenant.tenantId }, 'TenantService.triggerSchemaCreation - Triggering schema creation');
    
    // TODO: Implement Step Function trigger for RDS schema creation
    // This would typically involve:
    // 1. Invoke Step Function with tenant data
    // 2. Step Function would execute Lambda to create schema
    // 3. Update tenant status based on schema creation result
    
    Logger.debug({ tenantId: tenant.tenantId }, 'TenantService.triggerSchemaCreation - Schema creation triggered');
  }

  /**
   * Helper method to trigger schema deletion in RDS (placeholder)
   */
  static async triggerSchemaDeletion(tenant) {
    Logger.debug({ tenantId: tenant.tenantId }, 'TenantService.triggerSchemaDeletion - Triggering schema deletion');
    
    // TODO: Implement Step Function trigger for RDS schema deletion
    // This would typically involve:
    // 1. Invoke Step Function with tenant data
    // 2. Step Function would execute Lambda to delete schema
    // 3. Cleanup all tenant data from schema before deletion
    
    Logger.debug({ tenantId: tenant.tenantId }, 'TenantService.triggerSchemaDeletion - Schema deletion triggered');
  }

  /**
   * Delete CloudFormation stack for private tenant in tenant account
   */
  static async deleteTenantCloudFormationStack(tenantId, stackId) {
    Logger.debug({ tenantId, stackId }, 'TenantService.deleteTenantCloudFormationStack - Starting stack deletion');
    
    try {
      // Configure STS to assume role in tenant account
      const tenantAccountId = config.CROSS_ACCOUNT.TENANT_ACCOUNT_ID;
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `DeleteStack-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
      };
      
      Logger.debug(assumeRoleParams, 'TenantService.deleteTenantCloudFormationStack - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
      
      // Configure CloudFormation with assumed role credentials
      const cloudFormation = new AWS.CloudFormation({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });
      
      // Generate stack name (should match the creation pattern)
      const stackName = `tenant-${tenantId}-dynamodb`;
      
      // Delete CloudFormation stack
      const deleteStackParams = {
        StackName: stackName
      };
      
      Logger.debug({ stackName, tenantId }, 'TenantService.deleteTenantCloudFormationStack - Deleting CloudFormation stack');
      await cloudFormation.deleteStack(deleteStackParams).promise();
      
      Logger.debug({ stackName, tenantId }, 'TenantService.deleteTenantCloudFormationStack - CloudFormation stack deletion initiated successfully');
      
      return {
        stackName,
        status: 'DELETE_IN_PROGRESS',
        message: 'Stack deletion initiated successfully'
      };
      
    } catch (error) {
      Logger.error(error, 'TenantService.deleteTenantCloudFormationStack - Error occurred');
      throw new InternalError(`Failed to delete CloudFormation stack: ${error.message}`);
    }
  }

  /**
   * Delete all items with PK "TENANT#<TENANT_ID>" from TENANT_PUBLIC table
   */
  static async deletePublicTenantData(tenantId) {
    Logger.debug({ tenantId }, 'TenantService.deletePublicTenantData - Starting public tenant data deletion');
    
    try {
      // Configure DynamoDB for tenant account
      const tenantAccountId = config.CROSS_ACCOUNT.TENANT_ACCOUNT_ID;
      const tenantRoleArn = `arn:aws:iam::${tenantAccountId}:role/${config.CROSS_ACCOUNT.CROSS_ACCOUNT_ROLE_NAME}`;
      
      const sts = new AWS.STS({
        region: config.CROSS_ACCOUNT.AWS_REGION
      });
      
      const assumeRoleParams = {
        RoleArn: tenantRoleArn,
        RoleSessionName: `DeletePublicData-${tenantId}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: 'tenant-provisioning'
      };
      
      Logger.debug(assumeRoleParams, 'TenantService.deletePublicTenantData - Assuming role');
      const assumeRoleResult = await sts.assumeRole(assumeRoleParams).promise();
      
      // Configure DynamoDB with assumed role credentials
      const dynamodb = new AWS.DynamoDB.DocumentClient({
        region: config.CROSS_ACCOUNT.AWS_REGION,
        accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
        secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
        sessionToken: assumeRoleResult.Credentials.SessionToken
      });
      
      const tableName = 'TENANT_PUBLIC';
      const tenantPK = `TENANT#${tenantId}`;
      
      // Query all items with the tenant PK
      const queryParams = {
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': tenantPK
        }
      };
      
      Logger.debug({ tableName, tenantPK }, 'TenantService.deletePublicTenantData - Querying items to delete');
      
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
      
      Logger.debug({ tenantId, itemCount: itemsToDelete.length }, 'TenantService.deletePublicTenantData - Found items to delete');
      
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
        
        Logger.debug({ tenantId, batchNumber: Math.floor(i / batchSize) + 1, batchSize: batch.length }, 'TenantService.deletePublicTenantData - Deleting batch');
        await dynamodb.batchWrite(batchWriteParams).promise();
        deletedCount += batch.length;
      }
      
      Logger.debug({ tenantId, deletedCount }, 'TenantService.deletePublicTenantData - Public tenant data deletion completed');
      
      return {
        deletedCount,
        tableName,
        message: 'All public tenant data deleted successfully'
      };
      
    } catch (error) {
      Logger.error(error, 'TenantService.deletePublicTenantData - Error occurred');
      throw new InternalError(`Failed to delete public tenant data: ${error.message}`);
    }
  }
}

module.exports = TenantService;
