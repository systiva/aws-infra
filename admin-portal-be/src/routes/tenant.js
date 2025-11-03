const express = require('express');
const router = express.Router();
const TenantService = require('../services/tenant-service');
const Logger = require('../../logger');

// GET /tenants - Get all tenants and total count
router.get('/', async (req, res, next) => {
  try {
    Logger.debug('GET /tenants - Retrieving all tenants');
    const serviceRes = await TenantService.getAllTenants();
    Logger.debug(serviceRes, 'GET /tenants - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /tenants - Error occurred');
    next(error);
  }
});

// GET /tenants/:tenantId - Get single tenant by ID
router.get('/:tenantId', async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    Logger.debug({ tenantId }, 'GET /tenants/:tenantId - Retrieving tenant by ID');
    const serviceRes = await TenantService.getTenantDetails(tenantId);
    Logger.debug(serviceRes, 'GET /tenants/:tenantId - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /tenants/:tenantId - Error occurred');
    next(error);
  }
});

// POST /onboard - Create new tenant
router.post('/onboard', async (req, res, next) => {
  try {
    Logger.debug(req.body, 'POST /onboard - Creating new tenant with data');
    const serviceRes = await TenantService.createTenant(req.body);
    Logger.debug(serviceRes, 'POST /onboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'POST /onboard - Error occurred');
    next(error);
  }
});

// PUT /onboard - Update existing tenant
router.put('/onboard', async (req, res, next) => {
  try {
    Logger.debug(req.body, 'PUT /onboard - Updating tenant with data');
    const serviceRes = await TenantService.updateTenant(req.body);
    Logger.debug(serviceRes, 'PUT /onboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'PUT /onboard - Error occurred');
    next(error);
  }
});

// DELETE /offboard - Delete tenant
router.delete('/offboard', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        result: 'failed',
        msg: 'tenantId query parameter is required'
      });
    }
    Logger.debug({ tenantId }, 'DELETE /offboard - Offboarding tenant');
    const serviceRes = await TenantService.deleteTenant(tenantId);
    Logger.debug(serviceRes, 'DELETE /offboard - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'DELETE /offboard - Error occurred');
    next(error);
  }
});

// PUT /suspend - Suspend tenant (set status to inactive)
router.put('/suspend', async (req, res, next) => {
  try {
    const tenantId = req.query.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        result: 'failed',
        msg: 'tenantId query parameter is required'
      });
    }
    Logger.debug({ tenantId }, 'PUT /suspend - Suspending tenant');
    const serviceRes = await TenantService.suspendTenant(tenantId);
    Logger.debug(serviceRes, 'PUT /suspend - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'PUT /suspend - Error occurred');
    next(error);
  }
});

// GET /provisioning-status/:tenantId - Get tenant provisioning status
router.get('/provisioning-status/:tenantId', async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    Logger.debug({ tenantId }, 'GET /provisioning-status - Getting tenant provisioning status');
    const serviceRes = await TenantService.getTenantProvisioningStatus(tenantId);
    Logger.debug(serviceRes, 'GET /provisioning-status - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /provisioning-status - Error occurred');
    next(error);
  }
});

// POST /complete-provisioning/:tenantId - Complete tenant provisioning for completed CloudFormation stacks
router.post('/complete-provisioning/:tenantId', async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    Logger.debug({ tenantId }, 'POST /complete-provisioning - Completing tenant provisioning');
    const serviceRes = await TenantService.completeProvisioningForTenant(tenantId);
    Logger.debug(serviceRes, 'POST /complete-provisioning - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'POST /complete-provisioning - Error occurred');
    next(error);
  }
});

// GET /:tenantId - Get individual tenant details
router.get('/:tenantId', async (req, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    Logger.debug({ tenantId }, 'GET /:tenantId - Getting tenant details');
    const serviceRes = await TenantService.getTenantDetails(tenantId);
    Logger.debug(serviceRes, 'GET /:tenantId - Service response');
    res.status(serviceRes.status).json(serviceRes.json);
  } catch (error) {
    Logger.error(error, 'GET /:tenantId - Error occurred');
    next(error);
  }
});

module.exports = router;
