const { createTenantDynamooseInstance } = require('../db');
const { wrapDynamoDBOperation } = require('../dynamodb-error');
const logger = require('../../../logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Product Management Access Patterns
 * Handles all product-related DynamoDB operations using AWS SDK DocumentClient
 */
class ProductManagement {
    
    /**
     * Create a new product
     */
    static async createProduct(tenantContext, productData, userId) {
        return wrapDynamoDBOperation(async () => {
            const productId = productData.productId || uuidv4();
            const now = new Date().toISOString();
            
            const productPK = `TENANT#${tenantContext.tenantId}`;
            const productSK = `PRODUCT#${productId}`;
            
            const productItem = {
                PK: productPK,
                SK: productSK,
                entityType: 'PRODUCT',
                productId,
                name: productData.name,
                description: productData.description,
                sku: productData.sku,
                category: productData.category,
                price: productData.price,
                currency: productData.currency || 'USD',
                unit: productData.unit,
                status: productData.status || 'ACTIVE',
                metadata: productData.metadata || {},
                createdAt: now,
                updatedAt: now,
                createdBy: userId
            };
            
            logger.debug('Creating product', { productId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            await dbClient.docClient.put({
                TableName: dbClient.tableName,
                Item: productItem
            }).promise();
            
            return this.cleanProductResponse(productItem);
            
        }, 'createProduct', { tenantId: tenantContext.tenantId });
    }
    
    /**
     * Get product by ID
     */
    static async getProduct(tenantContext, productId) {
        return wrapDynamoDBOperation(async () => {
            const productPK = `TENANT#${tenantContext.tenantId}`;
            const productSK = `PRODUCT#${productId}`;
            
            logger.debug('Getting product', { productId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            const result = await dbClient.docClient.get({
                TableName: dbClient.tableName,
                Key: {
                    PK: productPK,
                    SK: productSK
                }
            }).promise();
            
            if (!result.Item) {
                return null;
            }
            
            return this.cleanProductResponse(result.Item);
            
        }, 'getProduct', { tenantId: tenantContext.tenantId, productId });
    }
    
    /**
     * Get all products in tenant
     */
    static async getAllProducts(tenantContext) {
        return wrapDynamoDBOperation(async () => {
            const productPK = `TENANT#${tenantContext.tenantId}`;
            
            logger.debug('Getting all products', { tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            const result = await dbClient.docClient.query({
                TableName: dbClient.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': productPK,
                    ':sk': 'PRODUCT#'
                }
            }).promise();
            
            return result.Items.map(product => this.cleanProductResponse(product));
            
        }, 'getAllProducts', { tenantId: tenantContext.tenantId });
    }
    
    /**
     * Update product
     */
    static async updateProduct(tenantContext, productId, updateData, userId) {
        return wrapDynamoDBOperation(async () => {
            const productPK = `TENANT#${tenantContext.tenantId}`;
            const productSK = `PRODUCT#${productId}`;
            const now = new Date().toISOString();
            
            logger.debug('Updating product', { productId, tenantId: tenantContext.tenantId });
            
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
                Key: { PK: productPK, SK: productSK },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            }).promise();
            
            return this.cleanProductResponse(result.Attributes);
            
        }, 'updateProduct', { tenantId: tenantContext.tenantId, productId });
    }
    
    /**
     * Delete product
     */
    static async deleteProduct(tenantContext, productId) {
        return wrapDynamoDBOperation(async () => {
            const productPK = `TENANT#${tenantContext.tenantId}`;
            const productSK = `PRODUCT#${productId}`;
            
            logger.debug('Deleting product', { productId, tenantId: tenantContext.tenantId });
            
            const dbClient = createTenantDynamooseInstance(
                tenantContext.credentials,
                tenantContext.orderTableName
            );
            
            await dbClient.docClient.delete({
                TableName: dbClient.tableName,
                Key: { PK: productPK, SK: productSK }
            }).promise();
            
            return { success: true, productId };
            
        }, 'deleteProduct', { tenantId: tenantContext.tenantId, productId });
    }
    
    /**
     * Clean product response
     */
    static cleanProductResponse(product) {
        if (!product) return product;
        
        const cleanProduct = { ...product };
        delete cleanProduct.PK;
        delete cleanProduct.SK;
        
        return cleanProduct;
    }
}

module.exports = ProductManagement;
