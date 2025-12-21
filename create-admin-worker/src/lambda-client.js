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
  async invokeLambda(httpMethod, path, body = null, accountId = null, userId = 'system-worker') {
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
          accountId: accountId,  // Account ID is always required for RBAC operations
          sub: userId,
          source: 'lambda-direct-invocation'
        }
      },
      isBase64Encoded: false
    };

    logger.info({
      functionName: this.functionName,
      method: httpMethod,
      path,
      accountId,
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
      
      logger.info({
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
   * Create a new user in IMS service
   * POST /api/v1/users
   */
  async createUser(userData, accountId) {
    logger.info({
      email: userData.email,
      accountId
    }, 'Creating user via Lambda invocation');

    return this.invokeLambda(
      'POST',
      '/api/v1/users',
      userData,
      accountId
    );
  }

  /**
   * Assign user to a group
   * POST /api/v1/rbac/users/{userId}/groups
   */
  async assignUserToGroup(userId, groupData, accountId) {
    logger.info({
      userId,
      groupId: groupData.groupId,
      accountId
    }, 'Assigning user to group via Lambda invocation');

    return this.invokeLambda(
      'POST',
      `/api/v1/rbac/users/${userId}/groups`,
      groupData,
      accountId
    );
  }

  /**
   * Get user by ID
   * GET /api/v1/users/{userId}
   */
  async getUser(userId, accountId) {
    logger.info({
      userId,
      accountId
    }, 'Getting user via Lambda invocation');

    return this.invokeLambda(
      'GET',
      `/api/v1/users/${userId}`,
      null,
      accountId
    );
  }
}

module.exports = IMSLambdaClient;
