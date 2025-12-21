const express = require('express');
const router = express.Router();
const CustomerManagement = require('../db/access-patterns/customer_management');
const { checkWritePermission, checkOMSAccess } = require('../middlewares/rbac');
const logger = require('../../logger');

/**
 * GET /api/v1/oms/customers
 * Get all customers for the account
 */
router.get('/', checkOMSAccess, async (req, res, next) => {
    try {
        logger.debug('Getting all customers', { 
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const customers = await CustomerManagement.getAllCustomers(req.accountContext);
        
        res.json({
            success: true,
            data: customers,
            count: customers.length
        });
        
    } catch (error) {
        logger.error('Error getting customers', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/v1/oms/customers/:customerId
 * Get a specific customer by ID
 */
router.get('/:customerId', checkOMSAccess, async (req, res, next) => {
    try {
        const { customerId } = req.params;
        
        logger.debug('Getting customer', { 
            customerId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const customer = await CustomerManagement.getCustomer(req.accountContext, customerId);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }
        
        res.json({
            success: true,
            data: customer
        });
        
    } catch (error) {
        logger.error('Error getting customer', { error: error.message });
        next(error);
    }
});

/**
 * POST /api/v1/oms/customers
 * Create a new customer
 */
router.post('/', checkWritePermission, async (req, res, next) => {
    try {
        const { name, email, phone, address, status, metadata } = req.body;
        
        // Validation
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }
        
        logger.debug('Creating customer', { 
            name,
            email,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const customerData = {
            name,
            email,
            phone,
            address,
            status,
            metadata
        };
        
        const customer = await CustomerManagement.createCustomer(
            req.accountContext,
            customerData,
            req.user.userId
        );
        
        res.status(201).json({
            success: true,
            data: customer
        });
        
    } catch (error) {
        logger.error('Error creating customer', { error: error.message });
        next(error);
    }
});

/**
 * PUT /api/v1/oms/customers/:customerId
 * Update an existing customer
 */
router.put('/:customerId', checkWritePermission, async (req, res, next) => {
    try {
        const { customerId } = req.params;
        const { name, email, phone, address, status, metadata } = req.body;
        
        logger.debug('Updating customer', { 
            customerId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (status !== undefined) updateData.status = status;
        if (metadata !== undefined) updateData.metadata = metadata;
        
        const customer = await CustomerManagement.updateCustomer(
            req.accountContext,
            customerId,
            updateData,
            req.user.userId
        );
        
        res.json({
            success: true,
            data: customer
        });
        
    } catch (error) {
        logger.error('Error updating customer', { error: error.message });
        next(error);
    }
});

/**
 * DELETE /api/v1/oms/customers/:customerId
 * Delete a customer
 */
router.delete('/:customerId', checkWritePermission, async (req, res, next) => {
    try {
        const { customerId } = req.params;
        
        logger.debug('Deleting customer', { 
            customerId,
            accountId: req.accountId,
            userId: req.user.userId 
        });
        
        await CustomerManagement.deleteCustomer(req.accountContext, customerId);
        
        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
        
    } catch (error) {
        logger.error('Error deleting customer', { error: error.message });
        next(error);
    }
});

module.exports = router;
