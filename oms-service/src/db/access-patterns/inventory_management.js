const { createAccountDynamooseInstance } = require('../db');
const { wrapDynamoDBOperation } = require('../dynamodb-error');
const logger = require('../../../logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Inventory Management Access Patterns
 * Handles all inventory-related DynamoDB operations
 */
class InventoryManagement {
    
    /**
     * Create or initialize inventory for a product
     */
    static async createInventory(accountContext, inventoryData, userId) {
        return wrapDynamoDBOperation(async () => {
            const { productId } = inventoryData;
            const now = new Date().toISOString();
            
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            
            const quantity = inventoryData.quantity || 0;
            const reservedQuantity = inventoryData.reservedQuantity || 0;
            
            const inventoryItem = {
                PK: inventoryPK,
                SK: inventorySK,
                entityType: 'INVENTORY',
                productId,
                quantity,
                reservedQuantity,
                availableQuantity: quantity - reservedQuantity,
                reorderLevel: inventoryData.reorderLevel || 10,
                reorderQuantity: inventoryData.reorderQuantity || 50,
                warehouseLocation: inventoryData.warehouseLocation,
                lastRestocked: inventoryData.lastRestocked || now,
                metadata: inventoryData.metadata || {},
                createdAt: now,
                updatedAt: now,
                createdBy: userId
            };
            
            logger.debug('Creating inventory', { productId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: inventoryItem
            }).promise();
            
            return this.cleanInventoryResponse(inventoryItem);
            
        }, 'createInventory', { accountId: accountContext.accountId });
    }
    
    /**
     * Get inventory for a product
     */
    static async getInventory(accountContext, productId) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            
            logger.debug('Getting inventory', { productId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: inventoryPK,
                    SK: inventorySK
                }
            }).promise();
            
            if (!result.Item) {
                return null;
            }
            
            return this.cleanInventoryResponse(result.Item);
            
        }, 'getInventory', { accountId: accountContext.accountId, productId });
    }
    
    /**
     * Get all inventory items
     */
    static async getAllInventory(accountContext) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            
            logger.debug('Getting all inventory', { accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': inventoryPK,
                    ':sk': 'INVENTORY#'
                }
            }).promise();
            
            return result.Items.map(inventory => this.cleanInventoryResponse(inventory));
            
        }, 'getAllInventory', { accountId: accountContext.accountId });
    }
    
    /**
     * Update inventory quantity (restock)
     */
    static async updateInventoryQuantity(accountContext, productId, quantityChange, userId) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating inventory quantity', { productId, quantityChange, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            // Get current inventory
            const currentResult = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: inventoryPK,
                    SK: inventorySK
                }
            }).promise();
            
            if (!currentResult.Item) {
                throw new Error('Inventory not found for product');
            }
            
            const current = currentResult.Item;
            const newQuantity = current.quantity + quantityChange;
            const newAvailableQuantity = newQuantity - current.reservedQuantity;
            
            // Update inventory
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: inventoryPK, SK: inventorySK },
                UpdateExpression: 'SET quantity = :qty, availableQuantity = :avail, lastRestocked = :restock, updatedAt = :updated, updatedBy = :updatedBy',
                ExpressionAttributeValues: {
                    ':qty': newQuantity,
                    ':avail': newAvailableQuantity,
                    ':restock': quantityChange > 0 ? now : current.lastRestocked,
                    ':updated': now,
                    ':updatedBy': userId
                },
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            // Create stock transaction record
            await this.createStockTransaction(
                dbClient,
                accountContext,
                productId,
                quantityChange,
                now,
                userId,
                newQuantity
            );
            
            return this.cleanInventoryResponse(result.Attributes);
            
        }, 'updateInventoryQuantity', { accountId: accountContext.accountId, productId, quantityChange });
    }
    
    /**
     * Reserve inventory (for orders)
     */
    static async reserveInventory(accountContext, productId, quantity, userId) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            const now = new Date().toISOString();
            
            logger.debug('Reserving inventory', { productId, quantity, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            // Get current inventory
            const currentResult = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: inventoryPK,
                    SK: inventorySK
                }
            }).promise();
            
            if (!currentResult.Item) {
                throw new Error('Inventory not found for product');
            }
            
            const current = currentResult.Item;
            
            if (current.availableQuantity < quantity) {
                throw new Error('Insufficient inventory available');
            }
            
            const newReservedQuantity = current.reservedQuantity + quantity;
            const newAvailableQuantity = current.quantity - newReservedQuantity;
            
            // Update inventory
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: inventoryPK, SK: inventorySK },
                UpdateExpression: 'SET reservedQuantity = :reserved, availableQuantity = :avail, updatedAt = :updated, updatedBy = :updatedBy',
                ExpressionAttributeValues: {
                    ':reserved': newReservedQuantity,
                    ':avail': newAvailableQuantity,
                    ':updated': now,
                    ':updatedBy': userId
                },
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanInventoryResponse(result.Attributes);
            
        }, 'reserveInventory', { accountId: accountContext.accountId, productId, quantity });
    }
    
    /**
     * Release reserved inventory
     */
    static async releaseInventory(accountContext, productId, quantity, userId) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            const now = new Date().toISOString();
            
            logger.debug('Releasing inventory', { productId, quantity, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            // Get current inventory
            const currentResult = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: inventoryPK,
                    SK: inventorySK
                }
            }).promise();
            
            if (!currentResult.Item) {
                throw new Error('Inventory not found for product');
            }
            
            const current = currentResult.Item;
            const newReservedQuantity = Math.max(0, current.reservedQuantity - quantity);
            const newAvailableQuantity = current.quantity - newReservedQuantity;
            
            // Update inventory
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: inventoryPK, SK: inventorySK },
                UpdateExpression: 'SET reservedQuantity = :reserved, availableQuantity = :avail, updatedAt = :updated, updatedBy = :updatedBy',
                ExpressionAttributeValues: {
                    ':reserved': newReservedQuantity,
                    ':avail': newAvailableQuantity,
                    ':updated': now,
                    ':updatedBy': userId
                },
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanInventoryResponse(result.Attributes);
            
        }, 'releaseInventory', { accountId: accountContext.accountId, productId, quantity });
    }
    
    /**
     * Create stock transaction record
     */
    static async createStockTransaction(dbClient, accountContext, productId, quantityChange, timestamp, userId, newQuantity) {
        const transactionId = uuidv4();
        const transactionPK = `PRODUCT#${accountContext.accountId}#${productId}#STOCK`;
        const transactionSK = `TRANSACTION#${timestamp}#${transactionId}`;
        
        await dbClient.docClient.put({
            TableName: dbClient.tableName,
            Item: {
                PK: transactionPK,
                SK: transactionSK,
                entityType: 'STOCK_TRANSACTION',
                productId,
                transactionId,
                quantityChange,
                newQuantity,
                timestamp,
                createdBy: userId
            }
        }).promise();
        
        logger.debug('Created stock transaction', { productId, transactionId, quantityChange });
    }
    
    /**
     * Get stock transaction history
     */
    static async getStockTransactions(accountContext, productId) {
        return wrapDynamoDBOperation(async () => {
            const transactionPK = `PRODUCT#${accountContext.accountId}#${productId}#STOCK`;
            
            logger.debug('Getting stock transactions', { productId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': transactionPK
                }
            }).promise();
            
            return result.Items.map(transaction => ({
                transactionId: transaction.transactionId,
                quantityChange: transaction.quantityChange,
                newQuantity: transaction.newQuantity,
                timestamp: transaction.timestamp,
                createdBy: transaction.createdBy
            }));
            
        }, 'getStockTransactions', { accountId: accountContext.accountId, productId });
    }
    
    /**
     * Update inventory settings
     */
    static async updateInventorySettings(accountContext, productId, settings, userId) {
        return wrapDynamoDBOperation(async () => {
            const inventoryPK = `ACCOUNT#${accountContext.accountId}`;
            const inventorySK = `INVENTORY#${productId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating inventory settings', { productId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const updateData = {
                ...settings,
                updatedAt: now,
                updatedBy: userId
            };
            
            // Build update expression
            const updateExpressions = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            
            Object.keys(updateData).forEach((key, index) => {
                const attrName = `#attr${index}`;
                const attrValue = `:val${index}`;
                updateExpressions.push(`${attrName} = ${attrValue}`);
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = updateData[key];
            });
            
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: inventoryPK, SK: inventorySK },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanInventoryResponse(result.Attributes);
            
        }, 'updateInventorySettings', { accountId: accountContext.accountId, productId });
    }
    
    /**
     * Clean inventory response
     */
    static cleanInventoryResponse(inventory) {
        if (!inventory) return inventory;
        
        const cleanInventory = { ...inventory };
        delete cleanInventory.PK;
        delete cleanInventory.SK;
        
        return cleanInventory;
    }
}

module.exports = InventoryManagement;
