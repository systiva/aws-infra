const { createTenantDynamooseInstance } = require('../db');
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
    static async createOrder(tenantContext, orderData, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderId = orderData.orderId || uuidv4();
            const now = new Date().toISOString();
            const orderDate = orderData.orderDate || now;
            
            const orderPK = `TENANT#${tenantContext.tenantId}`;
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
            
            logger.debug('Creating order', { orderId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: orderItem
            }).promise();
            
            // Create customer order relationship if customerId provided
            if (orderData.customerId) {
                await this.createCustomerOrderLink(
                    dbClient,
                    tenantContext,
                    orderData.customerId,
                    orderId,
                    orderDate
                );
            }
            
            return this.cleanOrderResponse(orderItem);
            
        }, 'createOrder', { tenantId: tenantContext.tenantId });
    }
    
    /**
     * Create customer-order relationship
     */
    static async createCustomerOrderLink(dbClient, tenantContext, customerId, orderId, orderDate) {
        const linkPK = `CUSTOMER#${tenantContext.tenantId}#${customerId}#ORDERS`;
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
    static async getOrder(tenantContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `TENANT#${tenantContext.tenantId}`;
            const orderSK = `ORDER#${orderId}`;
            
            logger.debug('Getting order', { orderId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
            
        }, 'getOrder', { tenantId: tenantContext.tenantId, orderId });
    }
    
    /**
     * Get all orders in tenant
     */
    static async getAllOrders(tenantContext) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `TENANT#${tenantContext.tenantId}`;
            
            logger.debug('Getting all orders', { tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
            
        }, 'getAllOrders', { tenantId: tenantContext.tenantId });
    }
    
    /**
     * Get orders by customer
     */
    static async getOrdersByCustomer(tenantContext, customerId) {
        return wrapDynamoDBOperation(async () => {
            const customerOrderPK = `CUSTOMER#${tenantContext.tenantId}#${customerId}#ORDERS`;
            
            logger.debug('Getting orders by customer', { customerId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
                const order = await this.getOrder(tenantContext, orderId);
                if (order) orders.push(order);
            }
            
            return orders;
            
        }, 'getOrdersByCustomer', { tenantId: tenantContext.tenantId, customerId });
    }
    
    /**
     * Update order
     */
    static async updateOrder(tenantContext, orderId, updateData, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `TENANT#${tenantContext.tenantId}`;
            const orderSK = `ORDER#${orderId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating order', { orderId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
            
        }, 'updateOrder', { tenantId: tenantContext.tenantId, orderId });
    }
    
    /**
     * Update order status
     */
    static async updateOrderStatus(tenantContext, orderId, status, userId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `TENANT#${tenantContext.tenantId}`;
            const orderSK = `ORDER#${orderId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating order status', { orderId, status, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
            const historyPK = `ORDER#${tenantContext.tenantId}#${orderId}#STATUS`;
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
            
        }, 'updateOrderStatus', { tenantId: tenantContext.tenantId, orderId, status });
    }
    
    /**
     * Get order status history
     */
    static async getOrderStatusHistory(tenantContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const historyPK = `ORDER#${tenantContext.tenantId}#${orderId}#STATUS`;
            
            logger.debug('Getting order status history', { orderId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
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
            
        }, 'getOrderStatusHistory', { tenantId: tenantContext.tenantId, orderId });
    }
    
    /**
     * Delete order
     */
    static async deleteOrder(tenantContext, orderId) {
        return wrapDynamoDBOperation(async () => {
            const orderPK = `TENANT#${tenantContext.tenantId}`;
            const orderSK = `ORDER#${orderId}`;
            
            logger.debug('Deleting order', { orderId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            await dbClient.docClient.delete({
                TableName: dbClient.tableName,
                Key: { PK: orderPK, SK: orderSK }
            }).promise();
            
            return { success: true, orderId };
            
        }, 'deleteOrder', { tenantId: tenantContext.tenantId, orderId });
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
