// AWS Lambda Client for direct IMS service invocation
// Bypasses API Gateway and JWT authentication for internal Lambda-to-Lambda calls

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const logger = require('../logger');

class IMSLambdaClient {
  constructor(config) {
    this.functionName = config.IMS_LAMBDA.FUNCTION_NAME;
    // AWS SDK automatically uses AWS_REGION environment variable in Lambda
    // No need to explicitly set region
    
    this.lambdaClient = new LambdaClient({});
    
    logger.info({
      functionName: this.functionName
    }, 'IMSLambdaClient initialized');
  }

  /**
   * Invoke IMS Lambda directly with API Gateway-compatible event structure
   * @private
   */
  async invokeLambda(httpMethod, path, body = null, tenantId = null, userId = 'setup-rbac-worker') {
    // Construct event in API Gateway format for serverless-http compatibility
    const event = {
      httpMethod,
      path,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null,
      requestContext: {
        // Simulate authenticated request context
        authorizer: {
          tenantId: tenantId || 'platform',
          sub: userId,
          source: 'lambda-direct-invocation'
        }
      },
      isBase64Encoded: false
    };

    logger.debug({
      functionName: this.functionName,
      method: httpMethod,
      path,
      tenantId,
      userId
    }, 'Invoking IMS Lambda directly');

    try {
      const command = new InvokeCommand({
        FunctionName: this.functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(event)
      });

      const response = await this.lambdaClient.send(command);
      
      // Parse Lambda response
      const payload = JSON.parse(Buffer.from(response.Payload).toString());
      
      logger.debug({
        statusCode: payload.statusCode,
        path
      }, 'IMS Lambda invocation completed');

      // Handle Lambda errors
      if (response.FunctionError) {
        logger.error({
          error: response.FunctionError,
          payload
        }, 'Lambda invocation error');
        
        throw new Error(`Lambda invocation failed: ${response.FunctionError}`);
      }

      // Parse API Gateway response format
      const statusCode = payload.statusCode || 200;
      const responseBody = payload.body ? JSON.parse(payload.body) : {};

      // Handle HTTP errors
      if (statusCode >= 400) {
        const error = new Error(responseBody.message || 'Request failed');
        error.status = statusCode;
        error.response = {
          status: statusCode,
          data: responseBody
        };
        throw error;
      }

      return {
        status: statusCode,
        data: responseBody
      };

    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack,
        functionName: this.functionName,
        path
      }, 'Failed to invoke IMS Lambda');
      
      throw error;
    }
  }

  /**
   * Create permission via IMS
   * POST /api/v1/rbac/permissions
   */
  async createPermission(permissionData, tenantId) {
    logger.debug({
      name: permissionData.name,
      tenantId
    }, 'Creating permission via IMS');

    return this.invokeLambda(
      'POST',
      '/api/v1/rbac/permissions',
      permissionData,
      tenantId
    );
  }

  /**
   * Create role via IMS (with permissions array)
   * POST /api/v1/rbac/roles
   */
  async createRole(roleData, tenantId) {
    logger.debug({
      name: roleData.name,
      permissionsCount: roleData.permissions?.length || 0,
      tenantId
    }, 'Creating role via IMS');

    return this.invokeLambda(
      'POST',
      '/api/v1/rbac/roles',
      roleData,
      tenantId
    );
  }

  /**
   * Create group via IMS
   * POST /api/v1/rbac/groups
   */
  async createGroup(groupData, tenantId) {
    logger.debug({
      name: groupData.name,
      tenantId
    }, 'Creating group via IMS');

    return this.invokeLambda(
      'POST',
      '/api/v1/rbac/groups',
      groupData,
      tenantId
    );
  }

  /**
   * Assign role to group via IMS
   * POST /api/v1/rbac/groups/{groupId}/roles
   */
  async assignRoleToGroup(groupId, roleId, tenantId) {
    logger.debug({
      groupId,
      roleId,
      tenantId
    }, 'Assigning role to group via IMS');

    return this.invokeLambda(
      'POST',
      `/api/v1/rbac/groups/${groupId}/roles`,
      { roleId },
      tenantId
    );
  }
}

module.exports = IMSLambdaClient;
