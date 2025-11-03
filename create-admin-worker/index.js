const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

/**
 * AWS Lambda handler for creating tenant admin user during onboarding
 * 
 * Expected input from Step Functions:
 * {
 *   "operation": "CREATE_ADMIN",
 *   "tenantId": "20241031",
 *   "tenantName": "Company XYZ",
 *   "firstName": "John",
 *   "lastName": "Doe", 
 *   "email": "john.doe@company.com",
 *   "password": "optional-temp-password",  // Optional: if not provided, will be generated
 *   "createdBy": "system",
 *   "registeredOn": "2024-10-31T..."
 * }
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  logger.info({
    event,
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion
  }, 'Create Admin Worker - Lambda invoked');

  try {
    // Extract and validate input
    const {
      operation,
      tenantId,
      tenantName,
      firstName,
      lastName,
      email,
      password,  // Optional password from frontend
      createdBy,
      registeredOn
    } = event;

    // Validate required fields
    if (operation !== 'CREATE_ADMIN') {
      throw new Error(`Invalid operation: ${operation}. Expected: CREATE_ADMIN`);
    }

    if (!tenantId || !firstName || !lastName || !email) {
      throw new Error('Missing required fields: tenantId, firstName, lastName, email are required');
    }

    // Validate environment configuration
    if (!config.PLATFORM.ADMIN_GROUP_ID) {
      throw new Error('TENANT_ADMIN_GROUP_ID environment variable is required');
    }

    logger.info({
      tenantId,
      tenantName,
      firstName,
      lastName,
      email,
      hasProvidedPassword: !!password,
      platformTenantId: config.PLATFORM.TENANT_ID,
      adminGroupId: config.PLATFORM.ADMIN_GROUP_ID
    }, 'Creating tenant admin user');

    // Step 1: Prepare admin user data
    const adminUserData = {
      name: `${firstName} ${lastName}`.trim(),
      email: email,
      password: password || generateSecurePassword(), // Use provided password or generate
      status: 'ACTIVE',
      created_by: createdBy || 'tenant-provisioning',
      tenantId: tenantId  // Use the actual tenant ID from user input
    };

      logger.info({
        tenantId,
        name: adminUserData.name,
        email: adminUserData.email,
        status: adminUserData.status,
        userTenantId: adminUserData.tenantId,
        passwordSource: password ? 'provided' : 'generated'
      }, 'Prepared admin user data');    // Step 2: Create user in IMS service (Platform tenant)
    let createdUser;
    let userCreationError = null;
    
    try {
      const userResponse = await axios.post(
        `${config.IMS_SERVICE.BASE_URL}/users`,
        adminUserData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: config.IMS_SERVICE.TIMEOUT
        }
      );

      createdUser = userResponse.data.data;
      logger.info({
        tenantId,
        userId: createdUser.user_id,
        email: createdUser.email,
        platformTenantId: config.PLATFORM.TENANT_ID
      }, 'User created successfully in IMS');

    } catch (userCreationErr) {
      userCreationError = userCreationErr;
      logger.error({
        tenantId,
        error: userCreationErr.message,
        status: userCreationErr.response?.status,
        data: userCreationErr.response?.data
      }, 'Failed to create user in IMS');
    }

    // Step 3: Assign user to tenant admin group (only if user creation succeeded)
    let groupAssignmentError = null;
    
    if (createdUser) {
      try {
        await axios.post(
          `${config.IMS_SERVICE.BASE_URL}/users/${createdUser.user_id}/groups`,
          {
            groupId: config.PLATFORM.ADMIN_GROUP_ID,
            tenantId: config.PLATFORM.TENANT_ID  // Pass tenantId in request body
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: config.IMS_SERVICE.TIMEOUT
          }
        );

        logger.info({
          tenantId,
          userId: createdUser.user_id,
          groupId: config.PLATFORM.ADMIN_GROUP_ID,
          platformTenantId: config.PLATFORM.TENANT_ID
        }, 'User assigned to tenant admin group successfully');

      } catch (groupAssignmentErr) {
        groupAssignmentError = groupAssignmentErr;
        logger.error({
          tenantId,
          userId: createdUser.user_id,
          groupId: config.PLATFORM.ADMIN_GROUP_ID,
          error: groupAssignmentErr.message,
          status: groupAssignmentErr.response?.status,
          data: groupAssignmentErr.response?.data
        }, 'Failed to assign user to group');
      }
    }

    // Step 4: Always return success response (manual handling for failures)
    const executionTime = Date.now() - startTime;
    
    const result = {
      success: true,
      tenantId: tenantId,
      adminUser: createdUser ? {
        user_id: createdUser.user_id,
        email: createdUser.email,
        name: createdUser.name,
        status: createdUser.status,
        tenant_id: config.PLATFORM.TENANT_ID,
        groups: groupAssignmentError ? [] : ['tenant-super-admin'],
        password_status: 'TEMPORARY',
        requiresPasswordChange: true,
        created_at: new Date().toISOString()
      } : null,
      errors: {
        userCreation: userCreationError ? {
          message: userCreationError.response?.data?.message || userCreationError.message,
          status: userCreationError.response?.status
        } : null,
        groupAssignment: groupAssignmentError ? {
          message: groupAssignmentError.response?.data?.message || groupAssignmentError.message,
          status: groupAssignmentError.response?.status
        } : null
      },
      message: createdUser 
        ? (groupAssignmentError 
            ? 'Tenant admin created but group assignment failed - manual intervention required'
            : 'Tenant admin created successfully in platform tenant')
        : 'Tenant admin creation failed - manual intervention required',
      executionTime: executionTime
    };

    logger.info({
      tenantId,
      userId: createdUser?.user_id,
      userCreated: !!createdUser,
      groupAssigned: !groupAssignmentError,
      executionTime
    }, 'Create Admin Worker completed');

    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error({
      error: error.message,
      stack: error.stack,
      executionTime,
      requestId: context.awsRequestId
    }, 'Create Admin Worker failed with validation error');

    // Return success response even for validation errors (manual handling)
    return {
      success: true,
      error: 'VALIDATION_FAILED',
      message: `Validation failed: ${error.message}`,
      tenantId: event.tenantId || 'unknown',
      adminUser: null,
      errors: {
        validation: {
          message: error.message
        }
      },
      executionTime
    };
  }
};

/**
 * Generate a secure password that meets Cognito requirements
 * Same algorithm as IMS generateTemporaryPassword()
 */
function generateSecurePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure password meets Cognito requirements
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length)); // uppercase
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length)); // lowercase
  password += numbers.charAt(Math.floor(Math.random() * numbers.length)); // number
  password += symbols.charAt(Math.floor(Math.random() * symbols.length)); // symbol
  
  // Add random characters to reach desired length (12 characters total)
  for (let i = 4; i < 12; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password to randomize character positions
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Export for local testing
if (require.main === module) {
  const testEvent = {
    operation: 'CREATE_ADMIN',
    tenantId: 'test-tenant-123',
    tenantName: 'Test Company',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@testcompany.com',
    createdBy: 'system',
    registeredOn: new Date().toISOString()
  };

  const testContext = {
    awsRequestId: 'test-request-id',
    functionName: 'create-admin-worker-test',
    functionVersion: '1'
  };

  console.log('Running local test...');
  exports.handler(testEvent, testContext)
    .then(result => {
      console.log('Test successful:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Test failed:', error.message);
    });
}