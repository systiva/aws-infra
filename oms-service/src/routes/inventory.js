const express = require('express');
const router = express.Router();
const InventoryManagement = require('../db/access-patterns/inventory_management');
const { checkWritePermission, checkOMSAccess } = require('../middlewares/rbac');
const logger = require('../../logger');

/**
 * GET /api/v1/oms/inventory
 * Get all inventory items for the tenant
 */
router.get('/', checkOMSAccess, async (req, res, next) => {
    try {
        logger.debug('Getting all inventory', { 
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventory = await InventoryManagement.getAllInventory(req.tenantContext);
        
        res.json({
            success: true,
            data: inventory,
            count: inventory.length
        });
        
    } catch (error) {
        logger.error('Error getting inventory', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/inventory/:productId
 * Get inventory for a specific product
 */
router.get('/:productId', checkOMSAccess, async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        logger.debug('Getting inventory', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventory = await InventoryManagement.getInventory(req.tenantContext, productId);
        
        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: 'Inventory not found for product'
            });
        }
        
        res.json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error getting inventory', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/inventory/:productId/transactions
 * Get stock transaction history for a product
 */
router.get('/:productId/transactions', checkOMSAccess, async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        logger.debug('Getting stock transactions', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const transactions = await InventoryManagement.getStockTransactions(req.tenantContext, productId);
        
        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
        
    } catch (error) {
        logger.error('Error getting stock transactions', { error: error.message });
        next(error);
    }
});

/**
 * POST /api/v1/oms/inventory
 * Create inventory for a product
 */
router.post('/', checkWritePermission, async (req, res, next) => {
    try {
        const { 
            productId, 
            quantity, 
            reservedQuantity, 
            reorderLevel, 
            reorderQuantity,
            warehouseLocation,
            metadata 
        } = req.body;
        
        // Validation
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }
        
        logger.debug('Creating inventory', { 
            productId,
            quantity,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventoryData = {
            productId,
            quantity,
            reservedQuantity,
            reorderLevel,
            reorderQuantity,
            warehouseLocation,
            metadata
        };
        
        const inventory = await InventoryManagement.createInventory(
            req.tenantContext,
            inventoryData,
            req.user.userId
        );
        
        res.status(201).json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error creating inventory', { error: error.message });
        next(error);
    }
});

/**
 * PATCH /api/v1/oms/inventory/:productId/quantity
 * Update inventory quantity (restock or reduce)
 */
router.patch('/:productId/quantity', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantityChange } = req.body;
        
        if (quantityChange === undefined || quantityChange === null) {
            return res.status(400).json({
                success: false,
                message: 'Quantity change is required'
            });
        }
        
        logger.debug('Updating inventory quantity', { 
            productId,
            quantityChange,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventory = await InventoryManagement.updateInventoryQuantity(
            req.tenantContext,
            productId,
            quantityChange,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error updating inventory quantity', { error: error.message });
        next(error);
    }
});

/**
 * PATCH /api/v1/oms/inventory/:productId/reserve
 * Reserve inventory for an order
 */
router.patch('/:productId/reserve', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }
        
        logger.debug('Reserving inventory', { 
            productId,
            quantity,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventory = await InventoryManagement.reserveInventory(
            req.tenantContext,
            productId,
            quantity,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error reserving inventory', { error: error.message });
        next(error);
    }
});

/**
 * PATCH /api/v1/oms/inventory/:productId/release
 * Release reserved inventory
 */
router.patch('/:productId/release', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }
        
        logger.debug('Releasing inventory', { 
            productId,
            quantity,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const inventory = await InventoryManagement.releaseInventory(
            req.tenantContext,
            productId,
            quantity,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error releasing inventory', { error: error.message });
        next(error);
    }
});

/**
 * PUT /api/v1/oms/inventory/:productId/settings
 * Update inventory settings (reorder levels, warehouse location, etc.)
 */
router.put('/:productId/settings', checkWritePermission, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { reorderLevel, reorderQuantity, warehouseLocation, metadata } = req.body;
        
        logger.debug('Updating inventory settings', { 
            productId,
            tenantId: req.tenantId,
            userId: req.user.userId 
        });
        
        const settings = {};
        if (reorderLevel !== undefined) settings.reorderLevel = reorderLevel;
        if (reorderQuantity !== undefined) settings.reorderQuantity = reorderQuantity;
        if (warehouseLocation !== undefined) settings.warehouseLocation = warehouseLocation;
        if (metadata !== undefined) settings.metadata = metadata;
        
        const inventory = await InventoryManagement.updateInventorySettings(
            req.tenantContext,
            productId,
            settings,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: inventory
        });
        
    } catch (error) {
        logger.error('Error updating inventory settings', { error: error.message });
        next(error);
    }
});

module.exports = router;
