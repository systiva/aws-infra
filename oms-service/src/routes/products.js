const express = require('express');
const router = express.Router();
const ProductManagement = require('../db/access-patterns/product_management');
const { checkWritePermission, checkOMSAccess } = require('../middlewares/rbac');
const logger = require('../../logger');

/**
 * GET /api/v1/oms/products
 * Get all products for the tenant
 */
router.get('/', checkOMSAccess, async (req, res, next) => {
    try {
        logger.debug('Getting all products', { 
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const products = await ProductManagement.getAllProducts(req.tenantContext);
        
        res.json({
            success: true,
            data: products,
            count: products.length
        });
        
    } catch (error) {
        logger.error('Error getting products', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/products/:productId
 * Get a specific product by ID
 */
router.get('/:productId', checkOMSAccess, async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        logger.debug('Getting product', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const product = await ProductManagement.getProduct(req.tenantContext, productId);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
        
    } catch (error) {
        logger.error('Error getting product', { error: error.message });
        next(error);
    }
});

/**
 * POST /api/v1/oms/products
 * Create a new product
 */
router.post('/', checkWritePermission, async (req, res, next) => {
    try {
        const { name, description, sku, category, price, currency, unit, status, metadata } = req.body;
        
        // Validation
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: 'Name and price are required'
            });
        }
        
        logger.debug('Creating product', { 
            name,
            sku,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const productData = {
            name,
            description,
            sku,
            category,
            price,
            currency,
            unit,
            status,
            metadata
        };
        
        const product = await ProductManagement.createProduct(
            req.tenantContext,
            productData,
            req.user.userId
        );
        
        res.status(201).json({
            success: true,
            data: product
        });
        
    } catch (error) {
        logger.error('Error creating product', { error: error.message });
        next(error);
    }
});

/**
 * PUT /api/v1/oms/products/:productId
 * Update an existing product
 */
router.put('/:productId', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { name, description, sku, category, price, currency, unit, status, metadata } = req.body;
        
        logger.debug('Updating product', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (sku !== undefined) updateData.sku = sku;
        if (category !== undefined) updateData.category = category;
        if (price !== undefined) updateData.price = price;
        if (currency !== undefined) updateData.currency = currency;
        if (unit !== undefined) updateData.unit = unit;
        if (status !== undefined) updateData.status = status;
        if (metadata !== undefined) updateData.metadata = metadata;
        
        const product = await ProductManagement.updateProduct(
            req.tenantContext,
            productId,
            updateData,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: product
        });
        
    } catch (error) {
        logger.error('Error updating product', { error: error.message });
        next(error);
    }
});

/**
 * DELETE /api/v1/oms/products/:productId
 * Delete a product
 */
router.delete('/:productId', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        logger.debug('Deleting product', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        await ProductManagement.deleteProduct(req.tenantContext, productId);
        
        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
        
    } catch (error) {
        logger.error('Error deleting product', { error: error.message });
        next(error);
    }
});

module.exports = router;
