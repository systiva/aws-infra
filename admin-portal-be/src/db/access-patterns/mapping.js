const DB = require('../db');
const dynamoose = require('dynamoose');
const Logger = require('../../../logger');
const DynamoDBError = require('../../utils/error/dynamodb-error');
const HASH_KEY = 'PK';
const RANGE_KEY = 'SK';

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
      Logger.info(`Getting item with PK: ${pk} and SK: ${sk}`);
      return await DB.get({
        PK: pk,
        SK: sk,
      });
    } catch (err) {
      console.log(JSON.stringify(err));

      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async deleteItem(pk, sk) {
    try {
      Logger.info(`Deleting item with PK: ${pk} and SK: ${sk}`);
      return await DB.delete({
        PK: pk,
        SK: sk,
      });
    } catch (err) {
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateItem(pk, sk, item) {
    try {
      Logger.info(`Updating item with PK: ${pk} and SK: ${sk}`);
      return await DB.update(
        {
          PK: pk,
          SK: sk,
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
      Logger.info(`Querying items with PK: ${pk}`);
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

  // Helper method to clean account response data
  static cleanAccountResponse(account) {
    if (!account) return account;
    
    const cleanAccount = { ...account };
    // Remove internal DynamoDB keys and metadata
    delete cleanAccount.PK;
    delete cleanAccount.SK;
    delete cleanAccount.entityType;
    
    return cleanAccount;
  }

  // Helper method to clean multiple account responses
  static cleanAccountsResponse(accounts) {
    if (!Array.isArray(accounts)) return accounts;
    return accounts.map(account => this.cleanAccountResponse(account));
  }

  // Account-specific access patterns
  static async createAccount(account) {
    try {
      Logger.info(`Creating account: ${JSON.stringify(account)}`);
      const item = {
        PK: `ACCOUNT#${account.accountId}`,
        SK: `METADATA`,
        ...account,
        entityType: 'ACCOUNT'
      };
      const result = await this.putItem(item);
      // Clean up the response to remove internal DB keys
      return this.cleanAccountResponse(result);
    } catch (err) {
      Logger.error(`Error creating account: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async getAccount(accountId) {
    try {
      Logger.info(`Getting account with id: ${accountId}`);
      const result = await this.getItem(`ACCOUNT#${accountId}`, 'METADATA');
      return this.cleanAccountResponse(result);
    } catch (err) {
      Logger.error(`Error getting account: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async getAccountByName(accountName) {
    try {
      Logger.info(`Getting account by name: ${accountName}`);
      const accounts = await this.scanAccounts();
      const account = accounts.find(account => account.accountName === accountName);
      return this.cleanAccountResponse(account);
    } catch (err) {
      Logger.error(`Error getting account by name: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateAccount(accountId, updateData) {
    try {
      Logger.info(`Updating account: ${accountId} with data: ${JSON.stringify(updateData)}`);
      const updatedItem = await this.updateItem(`ACCOUNT#${accountId}`, 'METADATA', updateData);
      return this.cleanAccountResponse(updatedItem);
    } catch (err) {
      Logger.error(`Error updating account: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async updateAccountStatus(accountId, status) {
    try {
      Logger.info(`Updating account status: ${accountId} to ${status}`);
      return await this.updateItem(`ACCOUNT#${accountId}`, 'METADATA', { 
        provisioningState: status,
        lastModified: new Date().toISOString()
      });
    } catch (err) {
      Logger.error(`Error updating account status: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async deleteAccount(accountId) {
    try {
      Logger.info(`Deleting account: ${accountId}`);
      return await this.deleteItem(`ACCOUNT#${accountId}`, 'METADATA');
    } catch (err) {
      Logger.error(`Error deleting account: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async scanAccounts() {
    try {
      Logger.info('Scanning all accounts');
      const allItems = await this.scanItems();
      // Filter only account items
      const accounts = allItems.filter(item => 
        item.PK && item.PK.startsWith('ACCOUNT#') && item.SK === 'METADATA'
      );
      Logger.info(`Found ${accounts.length} accounts`);
      return this.cleanAccountsResponse(accounts);
    } catch (err) {
      Logger.error(`Error scanning accounts: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }

  static async queryAccountsByStatus(status) {
    try {
      Logger.info(`Querying accounts by status: ${status}`);
      const allAccounts = await this.scanAccounts();
      return allAccounts.filter(account => account.provisioningState === status);
    } catch (err) {
      Logger.error(`Error querying accounts by status: ${err.message}`);
      DynamoDBError.handleRequestExecutionError(err);
    }
  }
}

module.exports = MappingAccessPatterns;
