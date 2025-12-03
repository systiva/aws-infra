const logger = require('./logger');
const config = require('./config');
const IMSLambdaClient = require('./src/lambda-client');
const { DEFAULT_PERMISSIONS, DEFAULT_ROLES, DEFAULT_GROUPS } = require('./src/rbac-templates');

/**
 * Lambda handler to setup default RBAC for a new tenant via IMS service APIs
 * Flow:
 * 1. Create all permissions via IMS
 * 2. Create all roles (with permissions embedded) via IMS
 * 3. Create tenant-admin group via IMS
 * 4. Assign all roles to tenant-admin group via IMS
 * 5. Return tenant-admin group ID to Step Functions
 */
exports.handler = async (event) => {
  try {
    logger.info({ event }, 'Setup RBAC handler invoked');

    // Validate input - tenantId comes from Step Functions
    const { tenantId } = event;
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    logger.info({ tenantId }, 'Setting up default RBAC for tenant via IMS service');

    // Initialize IMS Lambda client
    const imsClient = new IMSLambdaClient(config);

    // Step 1: Create all permissions via IMS API
    logger.info('Creating default permissions via IMS');
    const createdPermissions = {};
    
    for (const permTemplate of DEFAULT_PERMISSIONS) {
      try {
        const response = await imsClient.createPermission({
          name: permTemplate.name,
          resource: permTemplate.resource,
          action: permTemplate.action,
          description: permTemplate.description
        }, tenantId);
        
        createdPermissions[permTemplate.name] = response.data.data.permissionId;
        logger.debug({ 
          permissionId: response.data.data.permissionId, 
          name: permTemplate.name 
        }, 'Permission created via IMS');
      } catch (error) {
        logger.error({ 
          error: error.message, 
          permission: permTemplate.name 
        }, 'Failed to create permission');
        throw error;
      }
    }
    
    logger.info({ count: Object.keys(createdPermissions).length }, 'Permissions created via IMS');

    // Step 2: Create all roles with permissions embedded via IMS API
    logger.info('Creating default roles via IMS');
    const createdRoles = {};
    
    for (const roleTemplate of DEFAULT_ROLES) {
      try {
        // Map permission names to IDs
        const permissionIds = roleTemplate.permissions.map(permName => {
          const permId = createdPermissions[permName];
          if (!permId) {
            logger.warn({ permName, role: roleTemplate.name }, 'Permission not found for role');
          }
          return permId;
        }).filter(id => id); // Remove nulls
        
        const response = await imsClient.createRole({
          name: roleTemplate.name,
          description: roleTemplate.description,
          permissions: permissionIds  // IMS stores permissions array in role
        }, tenantId);
        
        createdRoles[roleTemplate.name] = response.data.data.roleId;
        logger.debug({ 
          roleId: response.data.data.roleId, 
          name: roleTemplate.name,
          permissionsCount: permissionIds.length
        }, 'Role created via IMS');
      } catch (error) {
        logger.error({ 
          error: error.message, 
          role: roleTemplate.name 
        }, 'Failed to create role');
        throw error;
      }
    }
    
    logger.info({ count: Object.keys(createdRoles).length }, 'Roles created via IMS');

    // Step 3: Create tenant-admin group via IMS API
    logger.info('Creating tenant-admin group via IMS');
    const groupTemplate = DEFAULT_GROUPS[0]; // Only one group: tenant-admin
    
    let tenantAdminGroupId;
    try {
      const groupResponse = await imsClient.createGroup({
        name: groupTemplate.name,
        description: groupTemplate.description
      }, tenantId);
      
      tenantAdminGroupId = groupResponse.data.data.groupId;
      logger.info({ tenantAdminGroupId }, 'Tenant-admin group created via IMS');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create tenant-admin group');
      throw error;
    }

    // Step 4: Assign all roles to tenant-admin group via IMS API
    logger.info('Assigning roles to tenant-admin group via IMS');
    let roleMappingCount = 0;
    
    for (const roleName of groupTemplate.roles) {
      const roleId = createdRoles[roleName];
      if (!roleId) {
        logger.warn({ roleName }, 'Role not found for group mapping');
        continue;
      }
      
      try {
        await imsClient.assignRoleToGroup(tenantAdminGroupId, roleId, tenantId);
        roleMappingCount++;
        logger.debug({ roleId, roleName }, 'Role assigned to group via IMS');
      } catch (error) {
        logger.error({ 
          error: error.message, 
          roleId, 
          roleName 
        }, 'Failed to assign role to group');
        throw error;
      }
    }
    
    logger.info({ count: roleMappingCount }, 'Roles assigned to tenant-admin group via IMS');

    // Step 5: Return result
    const result = {
      statusCode: 200,
      tenantId,
      tenantAdminGroupId,
      summary: {
        permissionsCreated: Object.keys(createdPermissions).length,
        rolesCreated: Object.keys(createdRoles).length,
        groupsCreated: 1,
        roleMappings: roleMappingCount
      }
    };

    logger.info({ result }, 'RBAC setup completed successfully via IMS');
    return result;

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'RBAC setup failed');
    
    throw {
      statusCode: error.statusCode || 500,
      error: error.message || 'Failed to setup RBAC',
      details: error.stack
    };
  }
};
