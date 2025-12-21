const IMSLambdaClient = require('./src/lambda-client');
const config = require('./config');
const logger = require('./logger');

/**
 * AWS Lambda handler for creating account admin user during onboarding
 * 
 * Expected input from Step Functions:
 * {
 *   "operation": "CREATE_ADMIN",
 *   "accountId": "20241031",
 *   "accountName": "Company XYZ",
 *   "firstName": "John",
 *   "lastName": "Doe", 
 *   "adminEmail": "john.doe@company.com",  // Admin user email
 *   "adminPassword": "optional-temp-password",  // Optional: if not provided, will be generated
 *   "accountAdminGroupId": "uuid-of-account-admin-group",  // Dynamic group ID from setup-rbac-worker
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
      accountId,
      accountName,
      firstName,
      lastName,
      adminUsername,  // Username for Cognito login
      adminEmail,
      adminPassword,  // Optional password from frontend
      accountAdminGroupId,  // Dynamic group ID from setup-rbac-worker
      createdBy,
      registeredOn
    } = event;

    // Validate required fields
    if (operation !== 'CREATE_ADMIN') {
      throw new Error(`Invalid operation: ${operation}. Expected: CREATE_ADMIN`);
    }

    if (!accountId || !firstName || !lastName || !adminUsername || !adminEmail) {
      throw new Error('Missing required fields: accountId, firstName, lastName, adminUsername, adminEmail are required');
    }

    // Validate accountAdminGroupId from Step Functions
    if (!accountAdminGroupId) {
      throw new Error('accountAdminGroupId is required (should be provided by setup-rbac-worker)');
    }

    logger.info({
      accountId,
      accountName,
      firstName,
      lastName,
      adminUsername,
      adminEmail,
      hasProvidedPassword: !!adminPassword,
      accountAdminGroupId
    }, 'Creating account admin user');

    // Step 1: Prepare admin user data
    const adminUserData = {
      name: `${firstName} ${lastName}`.trim(),
      email: adminEmail,
      userId: adminUsername, // Use adminUsername as userId for Cognito
      password: adminPassword || generateSecurePassword(), // Use provided password or generate
      status: 'ACTIVE',
      created_by: createdBy || 'account-provisioning',
      accountId: accountId  // Use the actual account ID from user input
    };

      logger.info({
        accountId,
        name: adminUserData.name,
        email: adminUserData.email,
        userId: adminUserData.userId,
        status: adminUserData.status,
        userAccountId: adminUserData.accountId,
        passwordSource: adminPassword ? 'provided' : 'generated'
      }, 'Prepared admin user data');

    // Initialize IMS Lambda client for direct invocation
    const imsClient = new IMSLambdaClient(config);

    // Step 2: Create user in IMS service (in actual account, not platform)
    let createdUser;
    let userCreationError = null;
    
    try {
      const userResponse = await imsClient.createUser(
        adminUserData,
        accountId  // Use actual account ID so user is stored in same account as RBAC data
      );

      createdUser = userResponse.data.data;
      logger.info({
        accountId,
        userId: createdUser.user_id,
        email: createdUser.email,
        userStoredInAccount: accountId
      }, 'User created successfully in IMS');

    } catch (userCreationErr) {
      userCreationError = userCreationErr;
      logger.error({
        accountId,
        error: userCreationErr.message,
        status: userCreationErr.response?.status,
        data: userCreationErr.response?.data
      }, 'Failed to create user in IMS');
    }

    // Step 3: Assign user to account admin group (only if user creation succeeded)
    let groupAssignmentError = null;
    
    if (createdUser) {
      try {
        await imsClient.assignUserToGroup(
          createdUser.user_id,
          {
            groupId: accountAdminGroupId,  // Use dynamic group ID from setup-rbac-worker
            accountId: accountId  // Use actual account ID where group was created
          },
          accountId  // Query context in actual account
        );

        logger.info({
          accountId,
          userId: createdUser.user_id,
          groupId: accountAdminGroupId,  // Log the dynamic group ID
          assignedToAccount: accountId
        }, 'User assigned to account admin group successfully');

      } catch (groupAssignmentErr) {
        groupAssignmentError = groupAssignmentErr;
        logger.error({
          accountId,
          userId: createdUser.user_id,
          groupId: accountAdminGroupId,  // Log the dynamic group ID
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
      accountId: accountId,
      adminUser: createdUser ? {
        user_id: createdUser.user_id,
        email: createdUser.email,
        name: createdUser.name,
        status: createdUser.status,
        account_id: accountId,  // User belongs to actual account
        groups: groupAssignmentError ? [] : ['account-admin'],
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
            ? 'Account admin created but group assignment failed - manual intervention required'
            : 'Account admin created successfully')
        : 'Account admin creation failed - manual intervention required',
      executionTime: executionTime
    };

    logger.info({
      accountId,
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
      accountId: event.accountId || 'unknown',
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
    accountId: 'test-account-123',
    accountName: 'Test Company',
    firstName: 'John',
    lastName: 'Doe',
    adminEmail: 'john.doe@testcompany.com',
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