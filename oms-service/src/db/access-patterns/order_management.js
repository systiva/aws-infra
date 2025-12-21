const { createAccountDynamooseInstance } = require('../db');
const { wrapDynamoDBOperation } = require('../dynamodb-error');
const logger = require('../../../logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Order Management Access Patterns
 * Handles all order-related DynamoDB operations using AWS SDK DocumentClient
 */
class OrderManagement {
    
    /**
     * Create a new order
     */
    static async createOrder(accountContext, orderData, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderId = orderData.orderId || uuidv4();
            const now = new Date().toISOString();
            const orderDate = orderData.orderDate || now;
            
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            const orderSK = `ORDER#${orderId}`;
            
            const orderItem = {
                PK: orderPK,
                SK: orderSK,
                entityType: 'ORDER',
                orderId,
                customerId: orderData.customerId,
                orderDate,
                status: orderData.status || 'PENDING',
                totalAmount: orderData.totalAmount || 0,
                currency: orderData.currency || 'USD',
                items: orderData.items || [],
                shippingAddress: orderData.shippingAddress || {},
                billingAddress: orderData.billingAddress || {},
                paymentStatus: orderData.paymentStatus || 'PENDING',
                shipmentStatus: orderData.shipmentStatus || 'NOT_SHIPPED',
                notes: orderData.notes,
                metadata: orderData.metadata || {},
                createdAt: now,
                updatedAt: now,
                createdBy: userId
            };
            
            logger.debug('Creating order', { orderId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: orderItem
            }).promise();
            
            // Create customer order relationship if customerId provided
            if (orderData.customerId) {
                await this.createCustomerOrderLink(
                    dbClient,
                    accountContext,
                    orderData.customerId,
                    orderId,
                    orderDate
                );
            }
            
            return this.cleanOrderResponse(orderItem);
            
        }, 'createOrder', { accountId: accountContext.accountId });
    }
    
    /**
     * Create customer-order relationship
     */
    static async createCustomerOrderLink(dbClient, accountContext, customerId, orderId, orderDate) {
        const linkPK = `CUSTOMER#${accountContext.accountId}#${customerId}#ORDERS`;
        const linkSK = `ORDER#${orderDate}#${orderId}`;
        
        await dbClient.docClient.put({
            TableName: dbClient.tableName,
            Item: {
                PK: linkPK,
                SK: linkSK,
                entityType: 'CUSTOMER_ORDER_LINK',
                customerId,
                orderId,
                orderDate
            }
        }).promise();
        
        logger.debug('Created customer-order link', { customerId, orderId });
    }
    
    /**
     * Get order by ID
     */
    static async getOrder(accountContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            const orderSK = `ORDER#${orderId}`;
            
            logger.debug('Getting order', { orderId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: orderPK,
                    SK: orderSK
                }
            }).promise();
            
            if (!result.Item) {
                return null;
            }
            
            return this.cleanOrderResponse(result.Item);
            
        }, 'getOrder', { accountId: accountContext.accountId, orderId });
    }
    
    /**
     * Get all orders in account
     */
    static async getAllOrders(accountContext) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            
            logger.debug('Getting all orders', { accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': orderPK,
                    ':sk': 'ORDER#'
                }
            }).promise();
            
            return result.Items.map(order => this.cleanOrderResponse(order));
            
        }, 'getAllOrders', { accountId: accountContext.accountId });
    }
    
    /**
     * Get orders by customer
     */
    static async getOrdersByCustomer(accountContext, customerId) {
        return wrapDynamoDBOperation(async () => {
            const customerOrderPK = `CUSTOMER#${accountContext.accountId}#${customerId}#ORDERS`;
            
            logger.debug('Getting orders by customer', { customerId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': customerOrderPK
                }
            }).promise();
            
            // Get full order details for each link
            const orderIds = result.Items.map(link => link.orderId);
            const orders = [];
            
            for (const orderId of orderIds) {
                const order = await this.getOrder(accountContext, orderId);
                if (order) orders.push(order);
            }
            
            return orders;
            
        }, 'getOrdersByCustomer', { accountId: accountContext.accountId, customerId });
    }
    
    /**
     * Update order
     */
    static async updateOrder(accountContext, orderId, updateData, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            const orderSK = `ORDER#${orderId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating order', { orderId, accountId: accountContext.accountId });
            
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
                Key: { PK: orderPK, SK: orderSK },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanOrderResponse(result.Attributes);
            
        }, 'updateOrder', { accountId: accountContext.accountId, orderId });
    }
    
    /**
     * Update order status
     */
    static async updateOrderStatus(accountContext, orderId, status, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            const orderSK = `ORDER#${orderId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating order status', { orderId, status, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            // Update order status
            const result = await dbClient.docClient.update({
                TableName: dbClient.tableName,
                Key: { PK: orderPK, SK: orderSK },
                UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#updatedAt': 'updatedAt',
                    '#updatedBy': 'updatedBy'
                },
                ExpressionAttributeValues: {
                    ':status': status,
                    ':updatedAt': now,
                    ':updatedBy': userId
                },
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            // Create status history entry
            const historyPK = `ORDER#${accountContext.accountId}#${orderId}#STATUS`;
            const historySK = `HISTORY#${now}`;
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: {
                    PK: historyPK,
                    SK: historySK,
                    entityType: 'ORDER_STATUS_HISTORY',
                    orderId,
                    status,
                    timestamp: now,
                    updatedBy: userId
                }
            }).promise();
            
            return this.cleanOrderResponse(result.Attributes);
            
        }, 'updateOrderStatus', { accountId: accountContext.accountId, orderId, status });
    }
    
    /**
     * Get order status history
     */
    static async getOrderStatusHistory(accountContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const historyPK = `ORDER#${accountContext.accountId}#${orderId}#STATUS`;
            
            logger.debug('Getting order status history', { orderId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: {
                    ':pk': historyPK
                }
            }).promise();
            
            return result.Items.map(history => ({
                status: history.status,
                timestamp: history.timestamp,
                updatedBy: history.updatedBy
            }));
            
        }, 'getOrderStatusHistory', { accountId: accountContext.accountId, orderId });
    }
    
    /**
     * Delete order
     */
    static async deleteOrder(accountContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `ACCOUNT#${accountContext.accountId}`;
            const orderSK = `ORDER#${orderId}`;
            
            logger.debug('Deleting order', { orderId, accountId: accountContext.accountId });
            
            const dbClient = createAccountDynamooseInstance(
                accountContext.credentials,
                accountContext.orderTableName
            );
            
            await dbClient.docClient.delete({
                TableName: dbClient.tableName,
                Key: { PK: orderPK, SK: orderSK }
            }).promise();
            
            return { success: true, orderId };
            
        }, 'deleteOrder', { accountId: accountContext.accountId, orderId });
    }
    
    /**
     * Clean order response
     */
    static cleanOrderResponse(order) {
        if (!order) return order;
        
        const cleanOrder = { ...order };
        delete cleanOrder.PK;
        delete cleanOrder.SK;
        
        return cleanOrder;
    }
}

module.exports = OrderManagement;
