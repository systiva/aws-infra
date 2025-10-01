const DB = require('../db');
const dynamoose = require('dynamoose');
const Logger = require('../../../logger');
const DynamoDBError = require('../../utils/error/dynamodb-error');
const HASH_KEY = 'pk';
const RANGE_KEY = 'sk';

class MappingAccessPatterns {
  static async putItem(item) {
    try {
      Logger.info(`Putting item: ${JSON.stringify(item)}`);
      return await DB.create(item);
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async getItem(pk, sk) {
    try {
      Logger.info(`Getting item with pk: ${pk} and sk: ${sk}`);
      return await DB.get({
        pk: pk,
        sk: sk,
      });
    } catch (err) {
      console.log(JSON.stringify(err));

      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async deleteItem(pk, sk) {
    try {
      Logger.info(`Deleting item with pk: ${pk} and sk: ${sk}`);
      return await DB.delete({
        pk: pk,
        sk: sk,
      });
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateItem(pk, sk, item) {
    try {
      Logger.info(`Updating item with pk: ${pk} and sk: ${sk}`);
      return await DB.update(
        {
          pk: pk,
          sk: sk,
        },
        {
          $SET: item,
        },
      );
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async queryItems(pk) {
    try {
      Logger.info(`Querying items with pk: ${pk}`);
      return await DB.query(pk).exec();
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async scanItems() {
    try {
      Logger.info(`Scanning items`);
      return await DB.scan().exec();
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async batchPutItems(items) {
    try {
      return await DB.batchPut(items);
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  // Helper method to clean tenant response data
  static cleanTenantResponse(tenant) {
    if (!tenant) return tenant;
    
    const cleanTenant = { ...tenant };
    // Remove internal DynamoDB keys and metadata
    delete cleanTenant.pk;
    delete cleanTenant.sk;
    delete cleanTenant.entityType;
    
    return cleanTenant;
  }

  // Helper method to clean multiple tenant responses
  static cleanTenantsResponse(tenants) {
    if (!Array.isArray(tenants)) return tenants;
    return tenants.map(tenant => this.cleanTenantResponse(tenant));
  }

  // Tenant-specific access patterns
  static async createTenant(tenant) {
    try {
      Logger.info(`Creating tenant: ${JSON.stringify(tenant)}`);
      const item = {
        pk: `TENANT#${tenant.tenantId}`,
        sk: `METADATA`,
        ...tenant,
        entityType: 'TENANT'
      };
      const result = await this.putItem(item);
      // Clean up the response to remove internal DB keys
      return this.cleanTenantResponse(result);
    } catch (err) {
      Logger.error(`Error creating tenant: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async getTenant(tenantId) {
    try {
      Logger.info(`Getting tenant with id: ${tenantId}`);
      const result = await this.getItem(`TENANT#${tenantId}`, 'METADATA');
      return this.cleanTenantResponse(result);
    } catch (err) {
      Logger.error(`Error getting tenant: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async getTenantByName(tenantName) {
    try {
      Logger.info(`Getting tenant by name: ${tenantName}`);
      const tenants = await this.scanTenants();
      const tenant = tenants.find(tenant => tenant.tenantName === tenantName);
      return this.cleanTenantResponse(tenant);
    } catch (err) {
      Logger.error(`Error getting tenant by name: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateTenant(tenantId, updateData) {
    try {
      Logger.info(`Updating tenant: ${tenantId} with data: ${JSON.stringify(updateData)}`);
      const updatedItem = await this.updateItem(`TENANT#${tenantId}`, 'METADATA', updateData);
      return this.cleanTenantResponse(updatedItem);
    } catch (err) {
      Logger.error(`Error updating tenant: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateTenantStatus(tenantId, status) {
    try {
      Logger.info(`Updating tenant status: ${tenantId} to ${status}`);
      return await this.updateItem(`TENANT#${tenantId}`, 'METADATA', { 
        provisioningState: status,
        lastModified: new Date().toISOString()
      });
    } catch (err) {
      Logger.error(`Error updating tenant status: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async deleteTenant(tenantId) {
    try {
      Logger.info(`Deleting tenant: ${tenantId}`);
      return await this.deleteItem(`TENANT#${tenantId}`, 'METADATA');
    } catch (err) {
      Logger.error(`Error deleting tenant: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async scanTenants() {
    try {
      Logger.info('Scanning all tenants');
      const allItems = await this.scanItems();
      // Filter only tenant items
      const tenants = allItems.filter(item => 
        item.pk && item.pk.startsWith('TENANT#') && item.sk === 'METADATA'
      );
      Logger.info(`Found ${tenants.length} tenants`);
      return this.cleanTenantsResponse(tenants);
    } catch (err) {
      Logger.error(`Error scanning tenants: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async queryTenantsByStatus(status) {
    try {
      Logger.info(`Querying tenants by status: ${status}`);
      const allTenants = await this.scanTenants();
      return allTenants.filter(tenant => tenant.provisioningState === status);
    } catch (err) {
      Logger.error(`Error querying tenants by status: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }
}

module.exports = MappingAccessPatterns;
