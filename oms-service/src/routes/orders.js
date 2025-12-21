const express = require('express');
const router = express.Router();
const OrderManagement = require('../db/access-patterns/order_management');
const { checkWritePermission, checkOMSAccess } = require('../middlewares/rbac');
const logger = require('../../logger');

/**
 * GET /api/v1/oms/orders
 * Get all orders for the account
 */
router.get('/', checkOMSAccess, async (req, res, next) => {
    try {
        logger.debug('Getting all orders', { 
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const orders = await OrderManagement.getAllOrders(req.accountContext);
        
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
        
    } catch (error) {
        logger.error('Error getting orders', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/orders/customer/:customerId
 * Get all orders for a specific customer
 */
router.get('/customer/:customerId', checkOMSAccess, async (req, res, next) => {
    try {
        const { customerId } = req.params;
        
        logger.debug('Getting orders by customer', { 
            customerId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const orders = await OrderManagement.getOrdersByCustomer(req.accountContext, customerId);
        
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
        
    } catch (error) {
        logger.error('Error getting customer orders', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/orders/:orderId
 * Get a specific order by ID
 */
router.get('/:orderId', checkOMSAccess, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        
        logger.debug('Getting order', { 
            orderId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const order = await OrderManagement.getOrder(req.accountContext, orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        logger.error('Error getting order', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/orders/:orderId/status-history
 * Get order status history
 */
router.get('/:orderId/status-history', checkOMSAccess, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        
        logger.debug('Getting order status history', { 
            orderId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const history = await OrderManagement.getOrderStatusHistory(req.accountContext, orderId);
        
        res.json({
            success: true,
            data: history,
            count: history.length
        });
        
    } catch (error) {
        logger.error('Error getting order status history', { error: error.message });
        next(error);
    }
});

/**
 * POST /api/v1/oms/orders
 * Create a new order
 */
router.post('/', checkWritePermission, async (req, res, next) => {
    try {
        const { 
            customerId, 
            orderDate, 
            status, 
            totalAmount, 
            currency, 
            items, 
            shippingAddress, 
            billingAddress,
            paymentStatus,
            shipmentStatus,
            notes,
            metadata 
        } = req.body;
        
        // Validation
        if (!customerId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID and items are required'
            });
        }
        
        logger.debug('Creating order', { 
            customerId,
            itemCount: items.length,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const orderData = {
            customerId,
            orderDate,
            status,
            totalAmount,
            currency,
            items,
            shippingAddress,
            billingAddress,
            paymentStatus,
            shipmentStatus,
            notes,
            metadata
        };
        
        const order = await OrderManagement.createOrder(
            req.accountContext,
            orderData,
            req.user.userId
        );
        
        res.status(201).json({
            success: true,
            data: order
        });
        
    } catch (error) {
        logger.error('Error creating order', { error: error.message });
        next(error);
    }
});

/**
 * PUT /api/v1/oms/orders/:orderId
 * Update an existing order
 */
router.put('/:orderId', checkWritePermission, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { 
            status, 
            totalAmount, 
            items, 
            shippingAddress, 
            billingAddress,
            paymentStatus,
            shipmentStatus,
            notes,
            metadata 
        } = req.body;
        
        logger.debug('Updating order', { 
            orderId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
        if (items !== undefined) updateData.items = items;
        if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;
        if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
        if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
        if (shipmentStatus !== undefined) updateData.shipmentStatus = shipmentStatus;
        if (notes !== undefined) updateData.notes = notes;
        if (metadata !== undefined) updateData.metadata = metadata;
        
        const order = await OrderManagement.updateOrder(
            req.accountContext,
            orderId,
            updateData,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        logger.error('Error updating order', { error: error.message });
        next(error);
    }
});

/**
 * PATCH /api/v1/oms/orders/:orderId/status
 * Update order status only
 */
router.patch('/:orderId/status', checkWritePermission, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }
        
        logger.debug('Updating order status', { 
            orderId,
            status,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const order = await OrderManagement.updateOrderStatus(
            req.accountContext,
            orderId,
            status,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        logger.error('Error updating order status', { error: error.message });
        next(error);
    }
});

/**
 * DELETE /api/v1/oms/orders/:orderId
 * Delete an order
 */
router.delete('/:orderId', checkWritePermission, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        
        logger.debug('Deleting order', { 
            orderId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        await OrderManagement.deleteOrder(req.accountContext, orderId);
        
        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
        
    } catch (error) {
        logger.error('Error deleting order', { error: error.message });
        next(error);
    }
});

module.exports = router;
