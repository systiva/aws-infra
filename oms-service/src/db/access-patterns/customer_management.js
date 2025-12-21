const { createAccountDynamooseInstance } = require('../db');
const { wrapDynamoDBOperation } = require('../dynamodb-error');
const logger = require('../../../logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Customer Management Access Patterns
 * Handles all customer-related DynamoDB operations using AWS SDK DocumentClient
 */
class CustomerManagement {
    
    /**
     * Create a new customer
     */
    static async createCustomer(accountContext, customerData, userId) {
        return wrapDynamoDBOperation(async () => {
            const customerId = customerData.customerId || uuidv4();
            const now = new Date().toISOString();
            
            const customerPK = `ACCOUNT#${accountContext.accountId}`;
            const customerSK = `CUSTOMER#${customerId}`;
            
            const customerItem = {
                PK: customerPK,
                SK: customerSK,
                entityType: 'CUSTOMER',
                customerId,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address || {},
                status: customerData.status || 'ACTIVE',
                metadata: customerData.metadata || {},
                createdAt: now,
                updatedAt: now,
                createdBy: userId
            };
            
            logger.debug('Creating customer', { customerId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: customerItem
            }).promise();
            
            return this.cleanCustomerResponse(customerItem);
            
        }, 'createCustomer', { accountId: accountContext.accountId });
    }
    
    /**
     * Get customer by ID
     */
    static async getCustomer(accountContext, customerId) {
        return wrapDynamoDBOperation(async () => {
            const customerPK = `ACCOUNT#${accountContext.accountId}`;
            const customerSK = `CUSTOMER#${customerId}`;
            
            logger.debug('Getting customer', { customerId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: customerPK,
                    SK: customerSK
                }
            }).promise();
            
            if (!result.Item) {
                return null;
            }
            
            return this.cleanCustomerResponse(result.Item);
            
        }, 'getCustomer', { accountId: accountContext.accountId, customerId });
    }
    
    /**
     * Get all customers in account
     */
    static async getAllCustomers(accountContext) {
        return wrapDynamoDBOperation(async () => {
            const customerPK = `ACCOUNT#${accountContext.accountId}`;
            
            logger.debug('Getting all customers', { accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': customerPK,
                    ':sk': 'CUSTOMER#'
                }
            }).promise();
            
            return result.Items.map(customer => this.cleanCustomerResponse(customer));
            
        }, 'getAllCustomers', { accountId: accountContext.accountId });
    }
    
    /**
     * Update customer
     */
    static async updateCustomer(accountContext, customerId, updateData, userId) {
        return wrapDynamoDBOperation(async () => {
            const customerPK = `ACCOUNT#${accountContext.accountId}`;
            const customerSK = `CUSTOMER#${customerId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating customer', { customerId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const updateItem = {
                ...updateData,
                updatedAt: now,
                updatedBy: userId
            };
            
            // Build update expression
            const updateExpressions = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            
            Object.keys(updateItem).forEach((key, index) => {
                const attrName = `#attr${index}`;
                const attrValue = `:val${index}`;
                updateExpressions.push(`${attrName} = ${attrValue}`);
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = updateItem[key];
            });
            
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: customerPK, SK: customerSK },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanCustomerResponse(result.Attributes);
            
        }, 'updateCustomer', { accountId: accountContext.accountId, customerId });
    }
    
    /**
     * Delete customer
     */
    static async deleteCustomer(accountContext, customerId) {
        return wrapDynamoDBOperation(async () => {
            const customerPK = `ACCOUNT#${accountContext.accountId}`;
            const customerSK = `CUSTOMER#${customerId}`;
            
            logger.debug('Deleting customer', { customerId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            await dbClient.docClient.delete({
                TableName: dbClient.tableName,
                Key: { PK: customerPK, SK: customerSK }
            }).promise();
            
            return { success: true, customerId };
            
        }, 'deleteCustomer', { accountId: accountContext.accountId, customerId });
    }
    
    /**
     * Clean customer response
     */
    static cleanCustomerResponse(customer) {
        if (!customer) return customer;
        
        const cleanCustomer = { ...customer };
        delete cleanCustomer.PK;
        delete cleanCustomer.SK;
        
        return cleanCustomer;
    }
}

module.exports = CustomerManagement;
